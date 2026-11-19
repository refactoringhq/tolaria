import { execFile } from 'node:child_process'
import { mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  addAgentToken,
  formatTokenList,
  listAgentTokens,
  parseDuration,
  revokeAgentToken,
} from '../src/agentTokenAdmin.ts'
import { AgentTokenSet, type AgentTokenRecord, parseTokenFile } from '../src/agentTokens.ts'
import { dataDirOf, tokensFileOf } from '../src/dataPaths.ts'

// `pnpm run server:token`: add, list and revoke agent tokens in the token file, with no server running.

const NOW = Date.UTC(2026, 10, 17, 10)
const SCRIPT = fileURLToPath(new URL('../scripts/token.ts', import.meta.url))
const run = promisify(execFile)

let dir: string
let file: string

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'tolaria-token-command-'))
  file = join(dir, 'data', 'tokens.json')
})

afterEach(async () => {
  await rm(dir, { recursive: true, force: true })
})

async function records(): Promise<AgentTokenRecord[]> {
  return parseTokenFile(await readFile(file, 'utf8'), file)
}

describe('adding', () => {
  it('writes the token file with mode 0600 and only a hash, and the credential verifies', async () => {
    const { credential, token } = addAgentToken(file, { name: 'phone', role: 'viewer' }, NOW)
    expect((await stat(file)).mode & 0o777).toBe(0o600)
    const text = await readFile(file, 'utf8')
    expect(text).not.toContain(credential.split('.')[2])
    expect(token).toMatchObject({ name: 'phone', role: 'viewer', scope: 'whole vault', createdAt: NOW, expiresAt: null })
    expect(new AgentTokenSet(await records()).verify(credential, NOW)?.subject).toBe(`token:${token.id}`)
  })

  it('grants single notes, an expiry and a chosen author', async () => {
    addAgentToken(
      file,
      { name: 'agent', role: 'editor', notes: ['projects/alpha.md', 'inbox/ideas.md'], expiresIn: '30d', authorName: 'Agent', authorEmail: 'agent@example.com' },
      NOW,
    )
    const [record] = await records()
    expect(record.grants).toEqual([
      { scope: 'projects/alpha.md', role: 'editor' },
      { scope: 'inbox/ideas.md', role: 'editor' },
    ])
    expect(record.expiresAt).toBe(NOW + 30 * 86_400_000)
    expect(record.author).toEqual({ name: 'Agent', email: 'agent@example.com' })
  })

  it('refuses an owner role, a bad note, a taken name, a lone author part and a bad duration', () => {
    addAgentToken(file, { name: 'phone', role: 'viewer' }, NOW)
    expect(() => addAgentToken(file, { name: 'x', role: 'owner' })).toThrow(/viewer or editor/)
    expect(() => addAgentToken(file, { name: 'x', role: 'viewer', notes: ['../secret.md'] })).toThrow(/note path/)
    expect(() => addAgentToken(file, { name: 'phone', role: 'viewer' })).toThrow(/already/)
    expect(() => addAgentToken(file, { name: 'x', role: 'viewer', authorName: 'X' })).toThrow(/together/)
    expect(() => addAgentToken(file, { name: 'x', role: 'viewer', expiresIn: 'soon' })).toThrow(/duration/)
  })
})

describe('listing and revoking', () => {
  it('lists without secrets or hashes, and revokes by name or by id', async () => {
    const phone = addAgentToken(file, { name: 'phone', role: 'viewer' }, NOW)
    const ci = addAgentToken(file, { name: 'ci', role: 'editor', notes: ['a.md'], expiresIn: '12h' }, NOW)
    const listed = formatTokenList(listAgentTokens(file))
    for (const record of await records()) expect(listed).not.toContain(record.hash)
    expect(listed).not.toContain(phone.credential.split('.')[2])
    expect(listed).toContain('phone')
    expect(listed).toContain('1 note')

    expect(revokeAgentToken(file, 'phone').id).toBe(phone.token.id)
    expect(revokeAgentToken(file, ci.token.id).name).toBe('ci')
    expect(listAgentTokens(file)).toEqual([])
    expect(formatTokenList([])).toBe('No tokens.')
    expect(() => revokeAgentToken(file, 'phone')).toThrow(/no token/)
  })

  it('treats a missing file as no tokens and names a malformed one', async () => {
    expect(listAgentTokens(file)).toEqual([])
    await writeFile(join(dir, 'bad.json'), '{')
    expect(() => listAgentTokens(join(dir, 'bad.json'))).toThrow(join(dir, 'bad.json'))
  })
})

describe('durations and paths', () => {
  it('reads minutes, hours and days', () => {
    expect(parseDuration('45m')).toBe(45 * 60_000)
    expect(parseDuration('12h')).toBe(12 * 3_600_000)
    expect(parseDuration('30d')).toBe(30 * 86_400_000)
    expect(() => parseDuration('0d')).toThrow(/duration/)
  })

  it('finds the token file in the data directory unless told otherwise, never inside the vault', () => {
    const data = dataDirOf({ TOLARIA_SERVER_DATA_DIR: '/srv/tolaria' })
    expect(data).toBe('/srv/tolaria')
    expect(tokensFileOf({}, data)).toBe('/srv/tolaria/tokens.json')
    expect(tokensFileOf({ TOLARIA_SERVER_TOKENS_FILE: '/etc/tolaria/tokens.json' }, data)).toBe('/etc/tolaria/tokens.json')
    expect(() => tokensFileOf({ TOLARIA_SERVER_TOKENS_FILE: '/srv/tolaria/vault/tokens.json' }, data)).toThrow(/vault/)
    expect(() => tokensFileOf({ TOLARIA_SERVER_TOKENS_FILE: '/srv/tolaria/vault' }, data)).toThrow(/vault/)
  })
})

describe('the script', () => {
  const env = (): NodeJS.ProcessEnv => ({ ...process.env, TOLARIA_SERVER_TOKENS_FILE: file })

  async function token(...args: string[]): Promise<{ stdout: string; stderr: string; code: number }> {
    try {
      const { stdout, stderr } = await run(process.execPath, ['--experimental-strip-types', '--no-warnings', SCRIPT, ...args], { env: env() })
      return { stdout, stderr, code: 0 }
    } catch (error) {
      const failed = error as { stdout: string; stderr: string; code: number }
      return { stdout: failed.stdout, stderr: failed.stderr, code: failed.code }
    }
  }

  it('adds, lists and revokes, runs under plain node and exits non-zero with one line on bad input', async () => {
    const added = await token('add', '--name', 'phone', '--role', 'viewer')
    expect(added.code).toBe(0)
    const credential = /tat1\.\S+/.exec(added.stdout)?.[0] ?? ''
    expect(credential).not.toBe('')
    expect(added.stdout).toMatch(/not be shown again/)
    expect((await stat(file)).mode & 0o777).toBe(0o600)

    const listed = await token('list')
    expect(listed.stdout).toContain('phone')
    expect(listed.stdout).not.toContain(credential.split('.')[2])

    const bad = await token('add', '--name', 'x', '--role', 'owner')
    expect(bad.code).not.toBe(0)
    expect(bad.stderr.trim().split('\n')).toHaveLength(1)
    expect((await token('frobnicate')).code).not.toBe(0)

    expect((await token('revoke', 'phone')).code).toBe(0)
    expect((await token('list')).stdout).toContain('No tokens.')
  }, 60_000)
})

describe('a token file reached through a link', () => {
  it('is refused when the link leads into the vault', async () => {
    const { mkdir, symlink } = await import('node:fs/promises')
    const { assertOutsideVault } = await import('../src/dataPaths.ts')
    const vaultDir = join(dir, 'data', 'vault')
    await mkdir(vaultDir, { recursive: true })
    await symlink(vaultDir, join(dir, 'secrets'))

    expect(() => assertOutsideVault(join(dir, 'secrets', 'tokens.json'), vaultDir)).toThrow(/inside the vault/)
    expect(() => assertOutsideVault(join(dir, 'data', 'tokens.json'), vaultDir)).not.toThrow()
    expect(() => assertOutsideVault(join(dir, 'elsewhere', 'deeper', 'tokens.json'), vaultDir)).not.toThrow()
  })
})
