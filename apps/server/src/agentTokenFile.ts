import { readFileSync, statSync } from 'node:fs'
import type { Access } from './access.ts'
import { AgentTokenSet, isExpired, parseTokenFile, tokenSubject } from './agentTokens.ts'

/**
 * The agent tokens the server accepts, read from the token file and read again when the file
 * changes. The check is a `stat`, made at most once a second (`RELOAD_INTERVAL_MS`) whatever the
 * request rate, so revoking with `pnpm run server:token revoke` takes effect within about a second.
 * A token that is removed or expires is announced once to `onWithdrawn`, which closes its open
 * connections.
 */

export const RELOAD_INTERVAL_MS = 1000

export interface AgentTokensOptions {
  now?: () => number
  log?: (message: string) => void
}

/** What identifies one version of the file without reading it; null when there is no file. */
function stamp(file: string): string | null {
  const stats = statSync(file, { throwIfNoEntry: false })
  return stats ? `${stats.ino}:${stats.size}:${stats.mtimeMs}` : null
}

function read(file: string): AgentTokenSet {
  try {
    return new AgentTokenSet(parseTokenFile(readFileSync(file, 'utf8'), file))
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return new AgentTokenSet([])
    throw error
  }
}

export class AgentTokens {
  private readonly file: string
  private readonly now: () => number
  private readonly log: (message: string) => void
  private readonly listeners: ((subject: string) => void)[] = []
  /** Tokens already announced as withdrawn, so each is announced once. */
  private readonly withdrawn = new Set<string>()
  private set: AgentTokenSet
  private version: string | null
  private checkedAt: number
  /** The version that failed to parse, so it is reported once. */
  private failedVersion: string | null | undefined = undefined

  private constructor(file: string, options: AgentTokensOptions) {
    this.file = file
    this.now = options.now ?? Date.now
    this.log = options.log ?? (() => {})
    this.version = stamp(file)
    this.set = read(file)
    this.checkedAt = this.now()
  }

  /** Reads the file at startup: none means no tokens, a malformed one throws naming the file. */
  static load(file: string, options: AgentTokensOptions = {}): AgentTokens {
    return new AgentTokens(file, options)
  }

  get size(): number {
    return this.set.size
  }

  onWithdrawn(listener: (subject: string) => void): void {
    this.listeners.push(listener)
  }

  /** The access an agent token gives, or null. */
  of(credential: string): Access | null {
    this.refresh()
    return this.set.verify(credential, this.now())
  }

  /** Reads the file again if it changed, and announces withdrawn tokens; at most once a second. */
  refresh(): void {
    const now = this.now()
    if (now - this.checkedAt < RELOAD_INTERVAL_MS) return
    this.checkedAt = now
    this.reload()
    this.announceWithdrawn(now)
  }

  private reload(): void {
    const version = stamp(this.file)
    if (version === this.version || version === this.failedVersion) return
    try {
      const previous = this.set
      this.set = read(this.file)
      this.version = version
      this.failedVersion = undefined
      for (const token of previous.records()) {
        if (!this.set.has(token.id)) this.withdraw(token.id)
      }
    } catch {
      // Only the file's name: its content holds hashes.
      this.failedVersion = version
      this.log(`tokens: ${this.file} is malformed; keeping the tokens read before`)
    }
  }

  private announceWithdrawn(now: number): void {
    for (const token of this.set.records()) {
      if (isExpired(token, now)) this.withdraw(token.id)
    }
  }

  private withdraw(id: string): void {
    if (this.withdrawn.has(id)) return
    this.withdrawn.add(id)
    for (const listener of this.listeners) listener(tokenSubject(id))
  }
}
