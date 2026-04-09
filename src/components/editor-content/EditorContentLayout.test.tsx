import { createRef } from 'react'
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { EditorContentLayout } from './EditorContentLayout'

vi.mock('../BreadcrumbBar', () => ({
  BreadcrumbBar: () => <div data-testid="breadcrumb-bar" />,
}))

vi.mock('../TitleField', () => ({
  TitleField: () => <div data-testid="title-field-input" />,
}))

vi.mock('../NoteIcon', () => ({
  NoteIcon: ({ icon }: { icon: string | null }) => (
    icon
      ? <button type="button" data-testid="note-icon-display" />
      : <button type="button" data-testid="note-icon-add" />
  ),
}))

vi.mock('../ArchivedNoteBanner', () => ({
  ArchivedNoteBanner: () => <div data-testid="archived-banner" />,
}))

vi.mock('../ConflictNoteBanner', () => ({
  ConflictNoteBanner: () => <div data-testid="conflict-banner" />,
}))

vi.mock('../RawEditorView', () => ({
  RawEditorView: () => <div data-testid="raw-editor-view" />,
}))

vi.mock('../SingleEditorView', () => ({
  SingleEditorView: () => <div data-testid="single-editor-view" />,
}))

vi.mock('../DiffView', () => ({
  DiffView: () => <div data-testid="diff-view" />,
}))

function createModel(overrides: Record<string, unknown> = {}) {
  return {
    activeTab: {
      entry: {
        path: '/vault/project/demo.md',
        filename: 'demo.md',
        title: 'Demo Note',
      },
      content: 'Body',
    },
    isLoadingNewTab: false,
    entries: [],
    editor: {},
    diffMode: false,
    diffContent: null,
    diffLoading: false,
    onToggleDiff: vi.fn(),
    effectiveRawMode: false,
    onToggleRaw: vi.fn(),
    onRawContentChange: vi.fn(),
    onSave: vi.fn(),
    showEditor: true,
    isArchived: false,
    onUnarchiveNote: undefined,
    path: '/vault/project/demo.md',
    isConflicted: false,
    onKeepMine: vi.fn(),
    onKeepTheirs: vi.fn(),
    breadcrumbBarRef: createRef<HTMLDivElement>(),
    wordCount: 12,
    titleSectionRef: createRef<HTMLDivElement>(),
    showTitleSection: true,
    hasDisplayIcon: false,
    entryIcon: null,
    vaultPath: '/vault',
    onTitleChange: vi.fn(),
    cssVars: {},
    onNavigateWikilink: vi.fn(),
    onEditorChange: vi.fn(),
    isDeletedPreview: false,
    rawLatestContentRef: { current: null },
    forceRawMode: false,
    showAIChat: false,
    onToggleAIChat: vi.fn(),
    inspectorCollapsed: true,
    onToggleInspector: vi.fn(),
    showDiffToggle: false,
    onToggleFavorite: vi.fn(),
    onToggleOrganized: vi.fn(),
    onDeleteNote: vi.fn(),
    onArchiveNote: vi.fn(),
    ...overrides,
  } as never
}

describe('EditorContentLayout', () => {
  it('does not render a standalone add-icon row when the note has no icon', () => {
    const { container } = render(<EditorContentLayout {...createModel()} />)

    expect(container.querySelector('.title-section__add-icon')).toBeNull()
    expect(container.querySelector('.title-section__inline-add-icon')).not.toBeNull()
    expect(screen.getByTestId('note-icon-add')).toBeInTheDocument()
  })

  it('keeps the existing icon and title inside the same title row', () => {
    const { container } = render(
      <EditorContentLayout
        {...createModel({
          hasDisplayIcon: true,
          entryIcon: 'rocket',
        })}
      />,
    )

    const titleRow = container.querySelector('.title-section__row')
    expect(titleRow?.querySelector('[data-testid="note-icon-display"]')).not.toBeNull()
    expect(titleRow?.querySelector('[data-testid="title-field-input"]')).not.toBeNull()
  })

  it('shows the loading skeleton instead of stale editor chrome while switching tabs', () => {
    const { container } = render(
      <EditorContentLayout
        {...createModel({
          activeTab: null,
          isLoadingNewTab: true,
        })}
      />,
    )

    expect(container.querySelector('.animate-pulse')).not.toBeNull()
    expect(screen.queryByTestId('title-field-input')).not.toBeInTheDocument()
  })
})
