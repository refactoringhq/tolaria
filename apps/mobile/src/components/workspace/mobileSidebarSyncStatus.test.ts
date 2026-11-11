import { afterEach, describe, expect, it, vi } from 'vitest'
import { sidebarSyncPresentation } from './mobileSidebarSyncStatus'

const now = Date.UTC(2026, 9, 18, 9)
const display = { source: 'native', rootUri: 'file:///owned-vault/' }
const controls = {
  rootUri: display.rootUri, git: true, linked: false, busy: false, status: 'pending' as const,
  historyAvailable: true, lastSuccessAt: now - 120_000,
  open: vi.fn(async () => {}), sync: vi.fn(async () => {}),
}
afterEach(() => vi.unstubAllGlobals())

describe('sidebar sync presentation', () => {
  it.each([null, { ...display, source: 'fixture' }, { ...display, rootUri: 'file:///other-vault/' }])(
    'never presents another vault or fixture as a native sync destination', source => {
      expect(sidebarSyncPresentation(controls, source, true, now)).toBeNull()
    })
  it('shows a GitHub destination, pending changes, last success and direct sync action', () => {
    expect(sidebarSyncPresentation(controls, display, true, now)).toMatchObject({
      destination: 'GitHub', state: 'Changes pending', lastSync: '2m ago', action: 'sync', disabled: false,
    })
  })
  it('distinguishes folder writeback from a verified cloud upload', () => {
    const result = sidebarSyncPresentation({ ...controls, git: false, linked: true, status: 'synced' }, display, true, now)
    expect(result).toMatchObject({ destination: 'Linked folder', state: 'Saved to folder', action: 'sync' })
    expect(JSON.stringify(result)).not.toContain('iCloud')
  })
  it('clearly identifies an unlinked vault and opens management instead of pretending to sync it', () => {
    expect(sidebarSyncPresentation({ ...controls, git: false, status: 'local' }, display, true, now)).toMatchObject({
      destination: 'Local only', state: 'Not linked', lastSync: null, action: 'manage',
    })
  })
  it.each(['pending', 'committed'] as const)('keeps %s changes visible until a successful sync', status => {
    expect(sidebarSyncPresentation({ ...controls, status }, display, true, now)?.state).toBe('Changes pending')
  })
  it.each([
    { status: 'pending', pendingLocalChanges: true },
    { status: 'committed', pendingLocalChanges: false },
    { status: 'synced', pendingLocalChanges: false },
    { status: 'failed', pendingLocalChanges: false },
  ] as const)('marks only known pending local changes for $status', ({ status, pendingLocalChanges }) => {
    expect(sidebarSyncPresentation({ ...controls, status }, display, true, now))
      .toMatchObject({ pendingLocalChanges })
  })
  it('does not invent local changes for an unlinked vault or unavailable history', () => {
    expect(sidebarSyncPresentation({ ...controls, git: false, linked: false }, display, true, now))
      .toMatchObject({ pendingLocalChanges: false })
    expect(sidebarSyncPresentation({ ...controls, historyAvailable: false }, display, true, now))
      .toMatchObject({ pendingLocalChanges: false })
  })
  it('routes uncommitted manual-mode changes through the existing commit controls', () => {
    expect(sidebarSyncPresentation(controls, display, false, now)?.action).toBe('manage')
    expect(sidebarSyncPresentation({ ...controls, status: 'committed' }, display, false, now)?.action).toBe('sync')
  })
  it('keeps sync failures visible and retryable without changing the last successful timestamp', () => {
    expect(sidebarSyncPresentation({ ...controls, status: 'failed' }, display, true, now)).toMatchObject({
      state: 'Sync failed', lastSync: '2m ago', action: 'sync', problem: true,
    })
  })
  it('shows failure age without presenting it as the last successful sync', () => {
    expect(sidebarSyncPresentation({ ...controls, status: 'failed', lastFailureAt: now - 60_000 }, display, true, now))
      .toMatchObject({ detail: 'Failed 1m ago', lastSync: '2m ago', problem: true })
  })
  it.each([
    ['checkpoint', 'Saving local changes...'], ['fetch', 'Fetching remote changes...'],
    ['checkout', 'Updating local files...'], ['push', 'Pushing local changes...'],
  ] as const)('shows the actual %s phase on the second line', (phase, detail) => {
    expect(sidebarSyncPresentation({ ...controls, busy: true, phase }, display, true, now))
      .toMatchObject({ detail, state: detail, disabled: true })
  })
  it('opens conflict review instead of repeatedly starting the same blocked sync', () => {
    expect(sidebarSyncPresentation({ ...controls, status: 'diverged' }, display, true, now)).toMatchObject({
      state: 'Conflict', action: 'manage', problem: true,
    })
  })
  it('never invents a successful sync from unavailable history', () => {
    expect(sidebarSyncPresentation({ ...controls, historyAvailable: false, status: 'synced' }, display, true, now)).toMatchObject({
      state: 'Status unavailable', detail: 'Status unavailable', lastSync: null,
      pendingLocalChanges: false, action: 'sync', problem: false,
    })
    expect(sidebarSyncPresentation({ ...controls, historyAvailable: false }, display, true, now)?.disabled).toBe(false)
  })
  it('shows never-synced explicitly and disables repeated taps while syncing', () => {
    expect(sidebarSyncPresentation({ ...controls, lastSuccessAt: null, busy: true }, display, true, now)).toMatchObject({
      state: 'Syncing...', lastSync: 'Never synced', disabled: true,
    })
  })
  it('handles future timestamps and old syncs without negative elapsed times', () => {
    expect(sidebarSyncPresentation({ ...controls, lastSuccessAt: now + 60_000 }, display, true, now)?.lastSync).toBe('now')
    expect(sidebarSyncPresentation({ ...controls, lastSuccessAt: now - 172_800_000 }, display, true, now)?.lastSync).toBe('2d ago')
  })
  it('renders sync history on Hermes without Intl.RelativeTimeFormat', () => {
    vi.stubGlobal('Intl', Object.create(Intl, { RelativeTimeFormat: { value: undefined } }))
    for (const [elapsed, label] of [[0, 'now'], [120_000, '2m ago'], [7_200_000, '2h ago'], [172_800_000, '2d ago']] as const) {
      expect(sidebarSyncPresentation({ ...controls, lastSuccessAt: now - elapsed }, display, true, now)?.lastSync).toBe(label)
    }
  })
})
