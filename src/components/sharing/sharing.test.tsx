import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import type { IncomingShare, OutgoingShare } from '../../lib/sharing/sharesApi'
import { resetSharingForTests, type SharingState } from '../../lib/sharing/sharingStore'
import { resetVaultAccessForTests, type VaultAccessState } from '../../lib/sharing/vaultAccess'
import { TooltipProvider } from '../ui/tooltip'
import { ShareNoteButton } from './ShareNoteButton'
import { SharedReadOnlyBanner } from './SharedReadOnlyBanner'
import { SharingStatusButton } from './SharingStatusButton'

type RemoteWindow = { TOLARIA_REMOTE_URL?: string; TOLARIA_REMOTE_TOKEN?: string }

const NOTE = 'notes/plan.md'
const ANA: OutgoingShare = { id: 's_1', scope: NOTE, role: 'editor', grantee: { userId: 'u_ana', email: 'ana@example.com', github: 'ana' } }
const VAULT_WIDE: OutgoingShare = { id: 's_2', scope: '*', role: 'viewer', grantee: { userId: 'u_bo', email: 'bo@example.com', github: null } }
const ELSEWHERE: OutgoingShare = { id: 's_3', scope: 'other.md', role: 'viewer', grantee: { userId: 'u_cy', email: 'cy@example.com', github: null } }
const INCOMING: IncomingShare = { id: 's_9', vaultId: 'v_9', scope: 'ideas/tea.md', role: 'viewer', owner: { userId: 'u_lu', email: null, github: 'luca' } }

function available(state: Partial<SharingState> = {}): SharingState {
  return { status: 'available', vaultId: 'v_1', outgoing: [], incoming: [], ...state }
}

/** The share API as the hosted front end answers it. */
function shareApi(handlers: Partial<Record<string, (init: RequestInit) => Response>> = {}) {
  const routes = new Map(Object.entries(handlers))
  const fetch = vi.fn(async (input: RequestInfo | URL, init: RequestInit = {}) => {
    const key = `${init.method ?? 'GET'} ${String(input)}`
    const handler = routes.get(key)
    if (handler) return handler(init)
    if (key === 'GET /api/shares') return Response.json({ vaultId: 'v_1', shares: [] })
    if (key === 'GET /api/shares/incoming') return Response.json({ shares: [] })
    return Response.json({ error: { code: 'not_found' } }, { status: 404 })
  })
  vi.stubGlobal('fetch', fetch)
  return fetch
}

beforeAll(() => {
  Element.prototype.hasPointerCapture ??= () => false
  Element.prototype.releasePointerCapture ??= () => {}
})

beforeEach(() => {
  Object.assign(window as RemoteWindow, { TOLARIA_REMOTE_URL: 'https://front.test', TOLARIA_REMOTE_TOKEN: 'via-front' })
})

afterEach(() => {
  vi.unstubAllGlobals()
  window.history.replaceState(null, '', '/')
  delete (window as RemoteWindow).TOLARIA_REMOTE_URL
  delete (window as RemoteWindow).TOLARIA_REMOTE_TOKEN
  resetSharingForTests()
  resetVaultAccessForTests()
})

function renderShareButton() {
  return render(<TooltipProvider><ShareNoteButton notePath={NOTE} /></TooltipProvider>)
}

async function openShareDialog() {
  fireEvent.click(screen.getByTestId('share-note-button'))
  await screen.findByTestId('share-dialog')
}

function chooseOption(trigger: HTMLElement, name: string) {
  fireEvent.pointerDown(trigger, { button: 0, ctrlKey: false, pointerType: 'mouse' })
  fireEvent.click(screen.getByRole('option', { name }))
}

describe('the Share button of a note', () => {
  it('is absent until the hosted share API answers, and in a vault shared with the user', () => {
    shareApi()
    const { rerender } = renderShareButton()
    expect(screen.queryByTestId('share-note-button')).toBeNull()

    window.history.replaceState(null, '', '/vaults/v_9/')
    act(() => resetSharingForTests(available()))
    rerender(<TooltipProvider><ShareNoteButton notePath={NOTE} /></TooltipProvider>)
    expect(screen.queryByTestId('share-note-button')).toBeNull()
  })

  it('lists who has the note or the whole vault, not who has other notes', async () => {
    shareApi({ 'GET /api/shares': () => Response.json({ vaultId: 'v_1', shares: [ANA, VAULT_WIDE, ELSEWHERE] }) })
    resetSharingForTests(available({ outgoing: [ANA, VAULT_WIDE, ELSEWHERE] }))
    renderShareButton()
    await openShareDialog()

    const people = screen.getAllByTestId('share-person').map((row) => row.textContent)
    expect(people).toEqual([expect.stringContaining('@ana'), expect.stringContaining('bo@example.com')])
    expect(people[1]).toContain('Whole vault')
  })

  it('invites by email to the note as an editor', async () => {
    const fetch = shareApi({ 'POST /api/shares': () => Response.json({ share: ANA }, { status: 201 }) })
    resetSharingForTests(available())
    renderShareButton()
    await openShareDialog()

    fireEvent.change(screen.getByTestId('share-invitee'), { target: { value: 'ana@example.com' } })
    fireEvent.click(screen.getByTestId('share-invite'))

    expect(await screen.findByTestId('share-success')).toHaveTextContent('ana@example.com can now open it from Shared with me.')
    expect(await screen.findByTestId('share-person')).toHaveTextContent('@ana')
    const post = fetch.mock.calls.find(([, init]) => init?.method === 'POST')
    expect(JSON.parse(String(post?.[1]?.body))).toEqual({ email: 'ana@example.com', role: 'editor', vaultId: 'v_1', path: NOTE })
  })

  it('shares the whole vault as a viewer by GitHub handle', async () => {
    const fetch = shareApi({ 'POST /api/shares': () => Response.json({ share: VAULT_WIDE }, { status: 201 }) })
    resetSharingForTests(available())
    renderShareButton()
    await openShareDialog()

    chooseOption(screen.getByTestId('share-scope'), 'Whole vault')
    chooseOption(screen.getByTestId('share-role'), 'Can view')
    fireEvent.change(screen.getByTestId('share-invitee'), { target: { value: '@bo' } })
    fireEvent.click(screen.getByTestId('share-invite'))

    await screen.findByTestId('share-success')
    const post = fetch.mock.calls.find(([, init]) => init?.method === 'POST')
    expect(JSON.parse(String(post?.[1]?.body))).toEqual({ github: 'bo', role: 'viewer', vaultId: 'v_1' })
  })

  it('says when there is no beta account, and when the text is neither an email nor a login', async () => {
    shareApi({ 'POST /api/shares': () => Response.json({ error: { code: 'user_not_found' } }, { status: 404 }) })
    resetSharingForTests(available())
    renderShareButton()
    await openShareDialog()

    fireEvent.change(screen.getByTestId('share-invitee'), { target: { value: 'nobody@example.com' } })
    fireEvent.click(screen.getByTestId('share-invite'))
    expect(await screen.findByTestId('share-error')).toHaveTextContent('No beta account with that email or GitHub username yet.')

    fireEvent.change(screen.getByTestId('share-invitee'), { target: { value: 'two words' } })
    expect(screen.queryByTestId('share-error')).toBeNull()
    fireEvent.click(screen.getByTestId('share-invite'))
    expect(await screen.findByTestId('share-error')).toHaveTextContent('Enter an email address or a GitHub username.')
  })

  it('changes a role and revokes a share', async () => {
    const fetch = shareApi({
      'GET /api/shares': () => Response.json({ vaultId: 'v_1', shares: [ANA] }),
      'POST /api/shares': () => Response.json({ share: { ...ANA, role: 'viewer' } }),
      'DELETE /api/shares/s_1': () => Response.json({ revoked: true }),
    })
    resetSharingForTests(available({ outgoing: [ANA] }))
    renderShareButton()
    await openShareDialog()

    chooseOption(screen.getByTestId('share-person-role'), 'Can view')
    await waitFor(() => expect(screen.getByTestId('share-person-role')).toHaveTextContent('Can view'))
    const post = fetch.mock.calls.find(([, init]) => init?.method === 'POST')
    expect(JSON.parse(String(post?.[1]?.body))).toEqual({ userId: 'u_ana', role: 'viewer', vaultId: 'v_1', path: NOTE })

    fireEvent.click(screen.getByTestId('share-person-remove'))
    expect(await screen.findByTestId('share-people-empty')).toHaveTextContent('Only you have access.')
  })

  it('reports a revoke that failed', async () => {
    shareApi({
      'GET /api/shares': () => Response.json({ vaultId: 'v_1', shares: [ANA] }),
      'DELETE /api/shares/s_1': () => Response.json({ error: { code: 'internal' } }, { status: 500 }),
    })
    resetSharingForTests(available({ outgoing: [ANA] }))
    renderShareButton()
    await openShareDialog()

    fireEvent.click(screen.getByTestId('share-person-remove'))

    expect(await screen.findByRole('alert')).toHaveTextContent("That didn't work.")
    expect(screen.getByTestId('share-person')).toBeInTheDocument()
  })
})

function renderStatus() {
  return render(<TooltipProvider><SharingStatusButton /></TooltipProvider>)
}

describe('the status bar sharing entry', () => {
  it('is absent where there is no sharing', () => {
    shareApi()
    resetSharingForTests({ status: 'unavailable', vaultId: null, outgoing: [], incoming: [] })
    renderStatus()
    expect(screen.queryByTestId('status-shared-with-me')).toBeNull()
  })

  it('lists what is shared with the user and opens it', async () => {
    shareApi({ 'GET /api/shares/incoming': () => Response.json({ shares: [INCOMING] }) })
    resetSharingForTests(available({ incoming: [INCOMING] }))
    const assign = vi.fn()
    vi.stubGlobal('location', { ...window.location, assign, pathname: '/' })
    renderStatus()

    fireEvent.click(screen.getByTestId('status-shared-with-me'))
    const item = await screen.findByTestId('shared-with-me-item')
    expect(item).toHaveTextContent('tea')
    expect(item).toHaveTextContent('from @luca')
    expect(item).toHaveTextContent('Can view')
    fireEvent.click(screen.getByTestId('shared-with-me-open'))

    expect(assign).toHaveBeenCalledWith('/vaults/v_9/?note=ideas%2Ftea.md')
  })

  it('shows an empty list and offers to share the own vault', async () => {
    shareApi()
    resetSharingForTests(available())
    renderStatus()

    fireEvent.click(screen.getByTestId('status-shared-with-me'))
    expect(await screen.findByTestId('shared-with-me-empty')).toHaveTextContent('Nothing has been shared with you yet.')
    fireEvent.click(screen.getByTestId('shared-with-me-share-vault'))

    expect(await screen.findByTestId('share-dialog')).toHaveTextContent('Invite people with a Tolaria account to your vault.')
    expect(screen.queryByTestId('share-scope')).toBeNull()
  })

  it.each<[VaultAccessState, string]>([
    [{ kind: 'shared', access: { subject: 'u_1', grants: [{ scope: '*', role: 'viewer' }] } }, 'Shared · View only'],
    [{ kind: 'shared', access: { subject: 'u_1', grants: [{ scope: NOTE, role: 'editor' }] } }, 'Shared · Can edit'],
    [{ kind: 'checking' }, 'Shared with me'],
  ])('says what the user may do in a shared vault', (access, label) => {
    shareApi()
    window.history.replaceState(null, '', '/vaults/v_9/')
    resetVaultAccessForTests(access)
    renderStatus()

    expect(screen.getByTestId('status-shared-role')).toHaveTextContent(label)
  })

  it('says when the share was revoked, and still lets the user find what is left', async () => {
    shareApi()
    window.history.replaceState(null, '', '/vaults/v_9/')
    resetVaultAccessForTests({ kind: 'revoked' })
    renderStatus()

    expect(await screen.findByTestId('access-revoked-dialog')).toHaveTextContent('This note or vault is no longer shared with you.')
    fireEvent.click(screen.getByTestId('access-revoked-shared-with-me'))
    expect(await screen.findByTestId('shared-with-me-dialog')).toBeInTheDocument()
    expect(screen.queryByTestId('access-revoked-dialog')).toBeNull()
    expect(screen.getByTestId('shared-with-me-home')).toBeInTheDocument()
  })
})

describe('the read-only banner', () => {
  it('shows for a note shared to view, not for the owner or an editor', () => {
    const { rerender } = render(<SharedReadOnlyBanner path={NOTE} />)
    expect(screen.queryByTestId('shared-read-only-banner')).toBeNull()

    act(() => resetVaultAccessForTests({ kind: 'shared', access: { subject: 'u_1', grants: [{ scope: NOTE, role: 'editor' }] } }))
    rerender(<SharedReadOnlyBanner path={NOTE} />)
    expect(screen.queryByTestId('shared-read-only-banner')).toBeNull()

    act(() => resetVaultAccessForTests({ kind: 'shared', access: { subject: 'u_1', grants: [{ scope: '*', role: 'viewer' }] } }))
    rerender(<SharedReadOnlyBanner path={NOTE} />)
    expect(screen.getByTestId('shared-read-only-banner')).toHaveTextContent('View only: you can read this note but not change it.')
  })
})
