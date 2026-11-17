import { chmod, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { AGENT_TOKEN_PREFIX, ACCESS_TICKET_PREFIX } from '../../../packages/protocol/src/index.ts'
import { AgentTokens } from '../src/agentTokenFile.ts'
import {
  type AgentTokenRecord,
  AgentTokenSet,
  isAgentToken,
  MAX_AGENT_TOKENS,
  mintAgentToken,
  parseTokenFile,
  serializeTokens,
  tokenSubject,
} from '../src/agentTokens.ts'

// Long-lived scoped tokens for agents (docs/web/agent-tokens-plan.md): the file format, minting and verifying.

const NOW = Date.UTC(2026, 10, 17, 10)
const VIEWER = [{ scope: '*', role: 'viewer' as const }]

function mint(name = 'phone', extra: Partial<Parameters<typeof mintAgentToken>[0]> = {}, existing: AgentTokenRecord[] = []) {
  return mintAgentToken({ name, grants: VIEWER, expiresAt: null, ...extra }, existing, NOW)
}

function fileOf(tokens: unknown[], version: unknown = 1): string {
  return JSON.stringify({ version, tokens })
}

describe('minting', () => {
  it('gives a tat1 credential whose secret is not in the record', () => {
    const { credential, record } = mint()
    expect(credential.startsWith(AGENT_TOKEN_PREFIX)).toBe(true)
    expect(AGENT_TOKEN_PREFIX.startsWith(ACCESS_TICKET_PREFIX)).toBe(false)
    const secret = credential.split('.')[2]
    expect(secret).toHaveLength(43)
    expect(JSON.stringify(record)).not.toContain(secret)
    expect(record).toMatchObject({ name: 'phone', grants: VIEWER, createdAt: NOW, expiresAt: null })
    expect(credential.split('.')[1]).toBe(record.id)
  })

  it('names the token in git under a reserved .invalid address by default, or as asked', () => {
    const { record } = mint()
    expect(record.author).toEqual({ name: 'phone', email: `${record.id}@tokens.tolaria.invalid` })
    const named = mint('ci', { author: { name: 'CI bot', email: 'ci@example.com' } }).record
    expect(named.author).toEqual({ name: 'CI bot', email: 'ci@example.com' })
  })

  it('refuses an owner grant, a bad name, a taken name, a bad author and the 101st token', () => {
    expect(() => mint('x', { grants: [{ scope: '*', role: 'owner' }] })).toThrow(/role/)
    expect(() => mint('x', { grants: [{ scope: '../etc/passwd', role: 'viewer' }] })).toThrow(/note/)
    expect(() => mint('')).toThrow(/name/)
    expect(() => mint('a'.repeat(65))).toThrow(/name/)
    expect(() => mint(' padded')).toThrow(/name/)
    expect(() => mint('a<b')).toThrow(/name/)
    expect(() => mint('x', { author: { name: 'x', email: 'not an address' } })).toThrow(/author/)
    const phone = mint().record
    expect(() => mint('phone', {}, [phone])).toThrow(/already/)
    const full = Array.from({ length: MAX_AGENT_TOKENS }, (_, index) => mint(`t${index}`).record)
    expect(() => mint('one-more', {}, full)).toThrow(/100/)
  })
})

describe('verifying', () => {
  it('gives the token’s grants to its subject, with its author', () => {
    const { credential, record } = mint()
    const access = new AgentTokenSet([record]).verify(credential, NOW)
    expect(access?.subject).toBe(tokenSubject(record.id))
    expect(access?.grants).toEqual(VIEWER)
    expect(access?.isOwner).toBe(false)
    expect(access?.coAuthors()).toEqual([record.author])
  })

  it('refuses a wrong secret with the right id, an unknown id and a malformed credential', () => {
    const { credential, record } = mint()
    const set = new AgentTokenSet([record])
    const [prefix, id] = credential.split('.')
    expect(set.verify(`${prefix}.${id}.${'A'.repeat(43)}`, NOW)).toBeNull()
    expect(set.verify(`${prefix}.${'B'.repeat(11)}.${credential.split('.')[2]}`, NOW)).toBeNull()
    expect(set.verify(`${credential}x`, NOW)).toBeNull()
    expect(set.verify('tat1.', NOW)).toBeNull()
    expect(isAgentToken(credential)).toBe(true)
    expect(isAgentToken('ta1.abc.def')).toBe(false)
  })

  it('refuses an expired token, on an injected clock', () => {
    const { credential, record } = mint('ci', { expiresAt: NOW + 1000 })
    const set = new AgentTokenSet([record])
    expect(set.verify(credential, NOW + 999)).not.toBeNull()
    expect(set.verify(credential, NOW + 1000)).toBeNull()
  })
})

describe('the token file', () => {
  it('round-trips and keeps only the hash', () => {
    const { credential, record } = mint()
    const text = serializeTokens([record])
    expect(text).not.toContain(credential.split('.')[2])
    expect(parseTokenFile(text, 'tokens.json')).toEqual([record])
  })

  it('refuses a malformed file with a message naming the file and no secret or hash', () => {
    const { record } = mint()
    const cases = [
      'not json',
      fileOf([record], 2),
      fileOf([{ ...record, grants: [{ scope: '*', role: 'owner' }] }]),
      fileOf([{ ...record, hash: 'short' }]),
      fileOf([{ ...record, id: 'x' }]),
      fileOf([{ ...record, expiresAt: 'soon' }]),
      fileOf([{ ...record, author: { name: 'a', email: 'nope' } }]),
      fileOf([record, { ...record, id: 'C'.repeat(11) }]),
      fileOf([record, { ...record, name: 'other' }]),
      fileOf(Array.from({ length: MAX_AGENT_TOKENS + 1 }, (_, index) => mint(`t${index}`).record)),
    ]
    for (const text of cases) {
      let message = ''
      try {
        parseTokenFile(text, '/data/tokens.json')
      } catch (error) {
        message = (error as Error).message
      }
      expect(message).toMatch(/^\/data\/tokens\.json: /)
      expect(message).not.toContain(record.hash)
    }
  })
})

describe('the live token set', () => {
  let dir: string
  let file: string
  let clock: number
  let logs: string[]

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'tolaria-tokens-'))
    file = join(dir, 'tokens.json')
    clock = NOW
    logs = []
  })

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true })
  })

  function load(): AgentTokens {
    return AgentTokens.load(file, { now: () => clock, log: (message) => logs.push(message) })
  }

  it('starts empty without a file, and refuses to start on a malformed one', async () => {
    expect(load().size).toBe(0)
    await writeFile(file, '{')
    expect(() => load()).toThrow(file)
  })

  it('reloads at most once a second when the file changes, and tells who was withdrawn', async () => {
    const phone = mint('phone')
    const ci = mint('ci')
    await writeFile(file, serializeTokens([phone.record, ci.record]))
    const tokens = load()
    const withdrawn: string[] = []
    tokens.onWithdrawn((subject) => withdrawn.push(subject))
    expect(tokens.of(phone.credential)).not.toBeNull()
    await writeFile(file, serializeTokens([ci.record]))
    clock += 500
    expect(tokens.of(phone.credential)).not.toBeNull()
    clock += 500
    expect(tokens.of(phone.credential)).toBeNull()
    expect(tokens.of(ci.credential)).not.toBeNull()
    expect(withdrawn).toEqual([tokenSubject(phone.record.id)])
  })

  it('withdraws a token once when it expires', async () => {
    const ci = mint('ci', { expiresAt: NOW + 5000 })
    await writeFile(file, serializeTokens([ci.record]))
    const tokens = load()
    const withdrawn: string[] = []
    tokens.onWithdrawn((subject) => withdrawn.push(subject))
    clock += 5000
    tokens.refresh()
    clock += 5000
    tokens.refresh()
    expect(withdrawn).toEqual([tokenSubject(ci.record.id)])
  })

  it('keeps the last good set on a malformed reload and logs once, without the file’s content', async () => {
    const phone = mint('phone')
    await writeFile(file, serializeTokens([phone.record]))
    const tokens = load()
    await writeFile(file, `${serializeTokens([phone.record])}garbage`)
    for (let step = 0; step < 3; step += 1) {
      clock += 1000
      expect(tokens.of(phone.credential)).not.toBeNull()
    }
    expect(logs).toHaveLength(1)
    expect(logs[0]).toContain(file)
    expect(logs[0]).not.toContain(phone.record.hash)
  })

  // Root bypasses file modes, so the file cannot be made unreadable for it.
  it.skipIf(process.getuid?.() === 0)('says a reload failed because the file cannot be read, not that it is malformed', async () => {
    const phone = mint('phone')
    await writeFile(file, serializeTokens([phone.record]))
    const tokens = load()
    // What `server:token add` run as another user leaves behind: a file the server may not read.
    await writeFile(file, serializeTokens([phone.record, mint('ci').record]))
    await chmod(file, 0o000)
    clock += 1000
    expect(tokens.of(phone.credential)).not.toBeNull()
    expect(logs).toEqual([`tokens: ${file} cannot be read: EACCES; keeping the tokens read before`])
  })

  it('withdraws every token when the file is deleted', async () => {
    const phone = mint('phone')
    await writeFile(file, serializeTokens([phone.record]))
    const tokens = load()
    await rm(file)
    clock += 1000
    expect(tokens.of(phone.credential)).toBeNull()
    expect(await readFile(file).catch(() => null)).toBeNull()
  })
})
