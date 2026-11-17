import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { useState } from 'react'
import { expect, vi } from 'vitest'
import { NoteList } from '../components/NoteList'
import type { ViewFile } from '../types'
import {
  allSelection,
  buildNoteListProps,
  makeEntry,
  makeTypeDefinition,
  renderNoteList,
} from './noteListTestUtils'

export function makeBookTypeEntries(
  displayProps: string[] = [],
  entryOverrides: Parameters<typeof makeEntry>[0] = {},
) {
  return [
    makeTypeDefinition('Book', displayProps),
    makeEntry({
      path: '/vault/book.md',
      filename: 'book.md',
      title: 'Book Note',
      isA: 'Book',
      createdAt: 1700000000,
      ...entryOverrides,
    }),
  ]
}

const noop = () => undefined
const NOTE_LIST_SEARCH_SETTLE_TIMEOUT_MS = 3_000
export const MAC_USER_AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_7) AppleWebKit/605.1.15 Safari/605.1.15'
export const WINDOWS_USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/125.0.0.0 Safari/537.36'

export function withUserAgent(userAgent: string, callback: () => void): void {
  const originalUserAgent = navigator.userAgent
  Object.defineProperty(window.navigator, 'userAgent', { value: userAgent, configurable: true })
  try {
    callback()
  } finally {
    Object.defineProperty(window.navigator, 'userAgent', { value: originalUserAgent, configurable: true })
  }
}

export function makeViewDefinition(overrides: Partial<ViewFile> = {}): ViewFile {
  return {
    filename: 'active-books.yml',
    definition: {
      name: 'Active Books',
      icon: null,
      color: null,
      sort: null,
      filters: { all: [{ field: 'type', op: 'equals', value: 'Book' }] },
      ...overrides.definition,
    },
    ...overrides,
  }
}

type ViewDefinitionPatch = Partial<ViewFile['definition']>

function patchViewDefinition(views: ViewFile[], filename: string, patch: ViewDefinitionPatch): ViewFile[] {
  return views.map((view) => {
    if (view.filename !== filename) return view
    return { ...view, definition: { ...view.definition, ...patch } }
  })
}

export function renderManagedViewNoteList({
  entries,
  view = makeViewDefinition(),
}: {
  entries: Parameters<typeof renderNoteList>[0]['entries']
  view?: ViewFile
}) {
  const built = buildNoteListProps({
    entries,
    selection: { kind: 'view', filename: view.filename },
    views: [view],
  })

  function ManagedViewNoteList() {
    const [views, setViews] = useState([view])

    function updateViewDefinition(filename: string, patch: ViewDefinitionPatch) {
      setViews((currentViews) => patchViewDefinition(currentViews, filename, patch))
    }

    return <NoteList {...built.props} views={views} onUpdateViewDefinition={updateViewDefinition} />
  }

  return {
    ...render(<ManagedViewNoteList />),
    ...built,
  }
}

export interface NoteListSearchMockResult {
  note_type: string
  path: string
  score: number
  snippet: string
  title: string
}

export function installFullTextSearchMocks({
  resultsByVault,
}: {
  resultsByVault: Record<string, NoteListSearchMockResult[]>
}) {
  if (!window.__mockHandlers) window.__mockHandlers = {}
  const handlers = window.__mockHandlers
  const originalContentHandler = handlers.get_note_content
  const originalSearchHandler = handlers.search_vault

  function searchVaultResponse(args: Record<string, unknown> = {}) {
    const results = resultsByVault[String(args.vaultPath)] ?? []
    return { elapsed_ms: 7, mode: args.mode, query: args.query, results }
  }

  function rejectNoteContentRead(): never {
    throw new Error('Note-list full-text search should not read note content in React')
  }

  const searchVault = vi.fn(searchVaultResponse)
  const getNoteContent = vi.fn(rejectNoteContentRead)
  handlers.search_vault = searchVault
  handlers.get_note_content = getNoteContent

  function restore() {
    handlers.search_vault = originalSearchHandler
    handlers.get_note_content = originalContentHandler
  }

  return { getNoteContent, restore, searchVault }
}

export function renderBookNoteList({
  displayProps = ['Priority'],
  entryOverrides = {},
  selection = allSelection,
  allNotesNoteListProperties,
  onUpdateAllNotesNoteListProperties = noop,
  inboxNoteListProperties,
  onUpdateInboxNoteListProperties = noop,
}: {
  displayProps?: string[]
  entryOverrides?: Parameters<typeof makeEntry>[0]
  selection?: Parameters<typeof renderNoteList>[0]['selection']
  allNotesNoteListProperties?: string[] | null
  onUpdateAllNotesNoteListProperties?: () => void
  inboxNoteListProperties?: string[] | null
  onUpdateInboxNoteListProperties?: () => void
} = {}) {
  return renderNoteList({
    entries: makeBookTypeEntries(displayProps, entryOverrides),
    selection,
    allNotesNoteListProperties,
    onUpdateAllNotesNoteListProperties,
    inboxNoteListProperties,
    onUpdateInboxNoteListProperties,
  })
}

export async function searchNoteList(query: string) {
  const searchInput = screen.queryByPlaceholderText('Search notes...')
  if (!searchInput) fireEvent.click(screen.getByTitle('Search notes'))
  fireEvent.change(screen.getByPlaceholderText('Search notes...'), { target: { value: query } })
  await waitFor(() => {
    expect(screen.getByTestId('note-list-search-loading')).toBeInTheDocument()
  }, { timeout: NOTE_LIST_SEARCH_SETTLE_TIMEOUT_MS })
  await waitFor(() => {
    expect(screen.queryByTestId('note-list-search-loading')).not.toBeInTheDocument()
  }, { timeout: NOTE_LIST_SEARCH_SETTLE_TIMEOUT_MS })
}

interface SearchMatchExpectation {
  title: string
  matchingQuery: string
  hiddenQuery: string
}

export async function expectOnlySearchMatch({ title, matchingQuery, hiddenQuery }: SearchMatchExpectation) {
  await searchNoteList(matchingQuery)
  expect(screen.getByText(title)).toBeInTheDocument()

  await searchNoteList(hiddenQuery)
  expect(screen.queryByText(title)).not.toBeInTheDocument()
  expect(screen.getByText('No matching notes')).toBeInTheDocument()
}
