import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { NoteCheckpoint } from '../../../packages/protocol/src/index'
import { DropdownMenu, DropdownMenuContent } from '@/components/ui/dropdown-menu'
import { closeNoteHistory, openNoteHistory } from '../../lib/noteHistory/noteHistoryDrawerStore'
import { resetVaultAccessForTests } from '../../lib/sharing/vaultAccess'
import { NoteHistoryDrawer } from './NoteHistoryDrawer'
import { NoteHistoryMenuItem } from './NoteHistoryMenuItem'

type RemoteWindow = { TOLARIA_REMOTE_URL?: string; TOLARIA_REMOTE_TOKEN?: string }

const NOTE = 'projects/alpha.md'
const NOW = '# Alpha\n\nSecond edit.\n'
const FIRST = '# Alpha\n\nFirst edit.\n'
const LATEST: NoteCheckpoint = { id: 'b'.repeat(40), time: '2026-11-25T20:40:10Z', author: 'Luca', message: `Update ${NOTE}` }
const EARLIER: NoteCheckpoint = { id: 'a'.repeat(40), time: '2026-11-25T20:39:00Z', author: 'Ana', message: `Update ${NOTE}` }
const RESTORED: NoteCheckpoint = { id: 'c'.repeat(40), time: '2026-11-25T20:41:00Z', author: 'Luca', message: `Restore ${NOTE}` }

interface ServerState {
  checkpoints: NoteCheckpoint[]
  content: string
  versions: Map<string, string>
  failList?: boolean
  failRestore?: boolean
}

let server: ServerState

/** The Tolaria remote's history and file routes, answered from `server`. */
function answer(url: string, init: RequestInit = {}): Response {
  const { pathname, searchParams } = new URL(url)
  if (pathname === '/v1/restore') return restoreAnswer(JSON.parse(String(init.body)) as { checkpoint: string })
  if (pathname === `/v1/history/${NOTE}`) return historyAnswer(searchParams.get('checkpoint'))
  if (pathname === `/v1/files/${NOTE}`) return new Response(server.content, { headers: { etag: '"e"' } })
  return Response.json({ error: { code: 'not_found' } }, { status: 404 })
}

function historyAnswer(checkpoint: string | null): Response {
  if (checkpoint) return new Response(server.versions.get(checkpoint))
  if (server.failList) return Response.json({ error: { code: 'internal' } }, { status: 500 })
  return Response.json({ path: NOTE, checkpoints: server.checkpoints })
}

function restoreAnswer({ checkpoint }: { checkpoint: string }): Response {
  if (server.failRestore) return Response.json({ error: { code: 'internal' } }, { status: 500 })
  const content = server.versions.get(checkpoint) ?? ''
  if (content === server.content) return Response.json({ outcome: 'unchanged', path: NOTE })
  server = { ...server, content, checkpoints: [RESTORED, ...server.checkpoints], versions: new Map([...server.versions, [RESTORED.id, content]]) }
  return Response.json({ outcome: 'updated', path: NOTE })
}

beforeEach(() => {
  server = { checkpoints: [LATEST, EARLIER], content: NOW, versions: new Map([[LATEST.id, NOW], [EARLIER.id, FIRST]]) }
  Object.assign(window as RemoteWindow, { TOLARIA_REMOTE_URL: 'https://vault.test', TOLARIA_REMOTE_TOKEN: 'token' })
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => answer(String(input), init)))
  resetVaultAccessForTests()
})

afterEach(() => {
  act(() => closeNoteHistory())
  vi.unstubAllGlobals()
  delete (window as RemoteWindow).TOLARIA_REMOTE_URL
  delete (window as RemoteWindow).TOLARIA_REMOTE_TOKEN
  resetVaultAccessForTests()
})

function openDrawer() {
  render(<NoteHistoryDrawer notePath={NOTE} locale="en" />)
  act(() => openNoteHistory(NOTE))
  return screen.getByTestId('note-history-drawer')
}

async function checkpointRows() {
  return within(await screen.findByTestId('note-history-list')).getAllByTestId('note-history-checkpoint')
}

describe('NoteHistoryDrawer', () => {
  it('lists the checkpoints newest first, with their time and author', async () => {
    const drawer = openDrawer()

    const rows = await checkpointRows()

    expect(within(drawer).getByText('Version history')).toBeTruthy()
    expect(rows).toHaveLength(2)
    expect(rows[0].textContent).toContain('Latest')
    expect(rows[0].textContent).toContain('by Luca')
    expect(rows[1].textContent).toContain('by Ana')
    expect(rows[1].textContent).toMatch(/2026/)
  })

  it('compares a picked checkpoint with the note now', async () => {
    openDrawer()
    fireEvent.click((await checkpointRows())[1])

    const diff = await screen.findByTestId('note-history-diff')

    expect(diff.querySelector('[data-diff-kind="removed"]')?.textContent).toContain('Second edit.')
    expect(diff.querySelector('[data-diff-kind="added"]')?.textContent).toContain('First edit.')
  })

  it('says so when the picked checkpoint is the note as it is now', async () => {
    openDrawer()
    fireEvent.click((await checkpointRows())[0])

    expect(await screen.findByText('This version is the same as the note now.')).toBeTruthy()
  })

  it('restores the picked checkpoint as a new one and keeps the later one listed', async () => {
    openDrawer()
    fireEvent.click((await checkpointRows())[1])
    await screen.findByTestId('note-history-diff')

    fireEvent.click(screen.getByTestId('note-history-restore'))

    expect(await screen.findByText('Restored. The version it replaced is still in the history.')).toBeTruthy()
    await waitFor(async () => expect(await checkpointRows()).toHaveLength(3))
    expect(server.content).toBe(FIRST)
    expect(await screen.findByText('This version is the same as the note now.')).toBeTruthy()
  })

  it('tells the user when the note already had that content', async () => {
    server.versions.set(EARLIER.id, NOW)
    openDrawer()
    fireEvent.click((await checkpointRows())[1])
    await screen.findByText('This version is the same as the note now.')

    fireEvent.click(screen.getByTestId('note-history-restore'))

    expect(await screen.findByText('The note already has this content.')).toBeTruthy()
  })

  it('does not compare a version too large to show, but still restores it', async () => {
    server.versions.set(EARLIER.id, `${'x'.repeat(400_001)}\n`)
    openDrawer()
    fireEvent.click((await checkpointRows())[1])

    expect(await screen.findByText('This version is too large to compare here. You can still restore it.')).toBeTruthy()
    expect(screen.queryByTestId('note-history-diff')).toBeNull()
    expect(screen.getByTestId('note-history-restore')).toHaveProperty('disabled', false)
  })

  it('reports a restore that failed', async () => {
    server.failRestore = true
    openDrawer()
    fireEvent.click((await checkpointRows())[1])
    await screen.findByTestId('note-history-diff')

    fireEvent.click(screen.getByTestId('note-history-restore'))

    expect(await screen.findByText("Couldn't restore this version. Try again.")).toBeTruthy()
  })

  it('lets a viewer preview but not restore', async () => {
    window.history.replaceState(null, '', '/vaults/v_1/')
    resetVaultAccessForTests({ kind: 'shared', access: { subject: 'u_ana', grants: [{ scope: '*', role: 'viewer' }] } })
    openDrawer()
    fireEvent.click((await checkpointRows())[1])

    await screen.findByTestId('note-history-diff')

    expect(screen.queryByTestId('note-history-restore')).toBeNull()
    expect(screen.getByTestId('note-history-view-only')).toBeTruthy()
    window.history.replaceState(null, '', '/')
  })

  it('says when the history could not be loaded', async () => {
    server.failList = true
    openDrawer()

    expect(await screen.findByText("Couldn't load the history. Close it and try again.")).toBeTruthy()
  })

  it('says when there is nothing in the history yet', async () => {
    server.checkpoints = []
    openDrawer()

    expect(await screen.findByText('No saved versions yet.')).toBeTruthy()
  })

  it('stays closed for another note', () => {
    render(<NoteHistoryDrawer notePath="other.md" locale="en" />)
    act(() => openNoteHistory(NOTE))

    expect(screen.queryByTestId('note-history-drawer')).toBeNull()
  })

  it('closes from its close button', async () => {
    openDrawer()
    await checkpointRows()

    fireEvent.click(screen.getByRole('button', { name: 'Close' }))

    await waitFor(() => expect(screen.queryByTestId('note-history-drawer')).toBeNull())
  })
})

describe('NoteHistoryMenuItem', () => {
  function renderItem(visible = true) {
    render(
      <DropdownMenu open>
        <DropdownMenuContent>
          <NoteHistoryMenuItem path={NOTE} visible={visible} locale="en" />
        </DropdownMenuContent>
      </DropdownMenu>,
    )
  }

  it('opens the history of the note', async () => {
    render(<NoteHistoryDrawer notePath={NOTE} locale="en" />)
    renderItem()

    fireEvent.click(screen.getByTestId('note-history-menu-item'))

    expect(await screen.findByTestId('note-history-drawer')).toBeTruthy()
  })

  it('is not there without a remote vault, or for a file that is not a note', () => {
    renderItem(false)
    expect(screen.queryByTestId('note-history-menu-item')).toBeNull()

    delete (window as RemoteWindow).TOLARIA_REMOTE_URL
    renderItem()
    expect(screen.queryByTestId('note-history-menu-item')).toBeNull()
  })
})
