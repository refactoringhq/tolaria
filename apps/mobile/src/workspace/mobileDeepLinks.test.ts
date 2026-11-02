import { describe, expect, it, vi } from 'vitest'
import { workspaceScenarioForId } from '../fixtures/workspaceFixtures'
import {
  buildMobileDeepLinkForNote,
  parseMobileIncomingDeepLink,
  resolveMobileDeepLinkNote,
  resolveMobileDeepLinkVault,
} from './mobileDeepLinks'
import type { MobileNote } from './mobileWorkspaceModel'
import { mobileWorkspaceDeepLinkSlug } from './mobileWorkspaceAlias'

describe('buildMobileDeepLinkForNote', () => {
  it('builds desktop-shaped Tolaria URLs from the active mobile vault and relative note path', () => {
    expect(buildMobileDeepLinkForNote({
      note: note({ path: 'Writing/Sponsorships/Acme call #1.md' }),
      source: {
        kind: 'localVault',
        label: 'Work Vault',
        totalNotes: 42,
        vaultPath: '/Users/luca/Work Vault',
        visibleNotes: 20,
      },
    })).toEqual({
      ok: true,
      url: 'tolaria://work-vault/Writing/Sponsorships/Acme%20call%20%231.md',
    })
  })

  it('falls back to the note workspace label before rejecting missing vault metadata', () => {
    expect(buildMobileDeepLinkForNote({
      note: note({ path: 'Inbox.md', workspace: 'Tolaria Vault' }),
    })).toEqual({
      ok: true,
      url: 'tolaria://tolaria-vault/Inbox.md',
    })

    expect(buildMobileDeepLinkForNote({
      note: note({ path: 'Inbox.md', workspace: '' }),
    })).toEqual({ error: 'missing_vault', ok: false })
  })

  it('rejects paths that cannot be vault-relative note paths', () => {
    expect(buildMobileDeepLinkForNote({
      note: note({ path: '../Outside.md' }),
      source: source(),
    })).toEqual({ error: 'unsafe_path', ok: false })
    expect(buildMobileDeepLinkForNote({
      note: note({ path: 'file:///Outside.md' }),
      source: source(),
    })).toEqual({ error: 'unsafe_path', ok: false })
  })

  it('uses the same slug shape as desktop workspace aliases', () => {
    expect(buildMobileDeepLinkForNote({
      note: note({ path: 'Inbox.md', workspace: '' }),
      source: {
        kind: 'localVault',
        label: '',
        totalNotes: 1,
        vaultPath: '/Users/luca/Work Vault',
        visibleNotes: 1,
      },
    })).toEqual({
      ok: true,
      url: 'tolaria://work-vault/Inbox.md',
    })
    expect(buildMobileDeepLinkForNote({
      note: note({ path: 'Inbox.md' }),
      source: {
        kind: 'localVault',
        label: '  Laputa / Personal  ',
        totalNotes: 1,
        vaultPath: '/ignored',
        visibleNotes: 1,
      },
    })).toEqual({
      ok: true,
      url: 'tolaria://laputa-personal/Inbox.md',
    })
  })

  it('builds copied links from the saved vault alias before the display label', () => {
    expect(buildMobileDeepLinkForNote({
      note: note({ path: 'Inbox.md', workspace: 'Personal Vault' }),
      source: { kind: 'localVault', alias: 'laputa', label: 'Personal Vault', totalNotes: 1, visibleNotes: 1 },
    })).toEqual({ ok: true, url: 'tolaria://laputa/Inbox.md' })
  })
})

describe('incoming mobile deep links', () => {
  const vaults = [
    { id: 'laputa', label: 'Laputa Vault', selected: false, select: vi.fn() },
    { id: 'work', label: 'Work Vault', selected: true, select: vi.fn() },
  ]

  it('parses safe Tolaria note URLs and leaves QA launch URLs to their existing handlers', () => {
    expect(parseMobileIncomingDeepLink('tolaria://laputa-vault/Folder/Note%20One.md')).toEqual({
      kind: 'note',
      relativePath: 'Folder/Note One.md',
      slug: 'laputa-vault',
    })
    expect(parseMobileIncomingDeepLink('tolaria://qa')).toEqual({ kind: 'ignored' })
    expect(parseMobileIncomingDeepLink('tolaria://mobile-ui-lab?layoutProbe=1')).toEqual({ kind: 'ignored' })
    expect(parseMobileIncomingDeepLink('tolaria:///?gitProbe=http%3A%2F%2F127.0.0.1')).toEqual({ kind: 'ignored' })
    expect(parseMobileIncomingDeepLink('tolaria://laputa-vault/%2E%2E/private.md')).toEqual({
      error: 'unsafe_path',
      kind: 'invalid',
    })
    expect(parseMobileIncomingDeepLink('tolaria://laputa-vault/folder%2Fprivate.md')).toEqual({
      error: 'unsafe_path',
      kind: 'invalid',
    })
  })

  it('matches a linked vault label and reports unknown or ambiguous aliases', () => {
    expect(resolveMobileDeepLinkVault(parsedNote('laputa-vault/Note.md').slug, vaults)).toEqual({ kind: 'matched', vault: vaults[0] })
    expect(resolveMobileDeepLinkVault(parsedNote('missing/Note.md').slug, vaults)).toEqual({ kind: 'unknown' })
    expect(resolveMobileDeepLinkVault(parsedNote('work-vault/Note.md').slug, [
      ...vaults,
      { ...vaults[0], id: 'second', label: 'Work Vault' },
    ])).toEqual({ kind: 'ambiguous' })
  })

  it('resolves a saved custom slug before the vault display label', () => {
    const choice = { id: 'laputa', label: 'Personal Vault', selected: true, select: vi.fn() }
    expect(resolveMobileDeepLinkVault(parsedNote('laputa/Note.md').slug, [choice])).toEqual({ kind: 'matched', vault: choice })
  })

  it('resolves the collision suffix used by copied links', () => {
    const savedVaults = [
      { id: 'one', label: 'Personal Vault', alias: 'laputa', selected: false, select: vi.fn() },
      { id: 'two', label: 'Personal Vault', alias: 'laputa', selected: true, select: vi.fn() },
    ]
    const target = mobileWorkspaceDeepLinkSlug(savedVaults[1], savedVaults)
    const choices = savedVaults.map((vault, index) => ({ ...vault,
      id: mobileWorkspaceDeepLinkSlug(vault, savedVaults), selected: index === 1 }))
    expect(resolveMobileDeepLinkVault(parsedNote(`${target}/Note.md`).slug, choices)).toEqual({ kind: 'matched', vault: choices[1] })
  })

  it('selects a note by its vault-relative path, not by title', () => {
    const target = note({ id: 'different-id', path: 'Folder/Note.md', title: 'A title' })
    const snapshot = { ...workspaceScenarioForId('default'), notes: [target], allNotes: [target] }
    expect(resolveMobileDeepLinkNote(snapshot, parsedNote('laputa/Folder/Note.md').relativePath)).toBe('different-id')
    expect(resolveMobileDeepLinkNote(snapshot, parsedNote('laputa/A%20title').relativePath)).toBeNull()
  })
})

function parsedNote(path: string) {
  const parsed = parseMobileIncomingDeepLink(`tolaria://${path}`)
  if (parsed.kind !== 'note') throw new Error('Expected a note deep link')
  return parsed
}

function source() {
  return {
    kind: 'localVault' as const,
    label: 'Laputa',
    totalNotes: 12,
    vaultPath: '/Users/luca/Laputa',
    visibleNotes: 8,
  }
}

function note(overrides: Partial<MobileNote> = {}): MobileNote {
  return {
    created: '-',
    date: '-',
    favorite: false,
    id: overrides.path ?? 'Writing/Note.md',
    links: 0,
    modified: '-',
    relationships: [],
    snippet: '',
    status: '',
    tags: [],
    title: 'Note',
    type: 'Note',
    typeTone: 'gray',
    workspace: 'Laputa',
    ...overrides,
  }
}
