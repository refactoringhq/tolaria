import type { NoteStatus, VaultEntry } from '../../types'
import { extractH1TitleFromContent } from '../../utils/noteTitle'
import { countWords } from '../../utils/wikilinks'

export interface EditorContentTab {
  entry: VaultEntry
  content: string
}

interface EditorContentStateInput {
  activeTab: EditorContentTab | null
  entries: VaultEntry[]
  rawMode: boolean
  activeStatus: NoteStatus
}

export interface EditorContentState {
  freshEntry: VaultEntry | undefined
  isArchived: boolean
  hasH1: boolean
  isDeletedPreview: boolean
  isNonMarkdownText: boolean
  effectiveRawMode: boolean
  showEditor: boolean
  showTitleSection: boolean
  path: string
  wordCount: number
}

function findFreshEntry(activeTab: EditorContentTab | null, entries: VaultEntry[]): VaultEntry | undefined {
  if (!activeTab) return undefined
  return entries.find((entry) => entry.path === activeTab.entry.path)
}

function contentHasTopLevelH1(activeTab: EditorContentTab | null): boolean {
  return activeTab ? extractH1TitleFromContent(activeTab.content) !== null : false
}

function resolveHasH1(activeTab: EditorContentTab | null, freshEntry: VaultEntry | undefined): boolean {
  return contentHasTopLevelH1(activeTab) || freshEntry?.hasH1 === true || activeTab?.entry.hasH1 === true
}

function isUnsavedUntitledDraft(activeTab: EditorContentTab | null, activeStatus: NoteStatus): boolean {
  if (!activeTab) return false
  if (!activeTab.entry.filename.startsWith('untitled-')) return false
  return activeStatus === 'new' || activeStatus === 'unsaved' || activeStatus === 'pendingSave'
}

export function deriveEditorContentState({
  activeTab,
  entries,
  rawMode,
  activeStatus,
}: EditorContentStateInput): EditorContentState {
  const freshEntry = findFreshEntry(activeTab, entries)
  const isDeletedPreview = !!activeTab && !freshEntry
  const hasH1 = resolveHasH1(activeTab, freshEntry)
  const isNonMarkdownText = activeTab?.entry.fileKind === 'text'
  const effectiveRawMode = rawMode || isNonMarkdownText
  const showEditor = !effectiveRawMode
  const showTitleSection = !isDeletedPreview && !hasH1 && !isUnsavedUntitledDraft(activeTab, activeStatus)

  return {
    freshEntry,
    isArchived: freshEntry?.archived ?? activeTab?.entry.archived ?? false,
    hasH1,
    isDeletedPreview,
    isNonMarkdownText,
    effectiveRawMode,
    showEditor,
    showTitleSection,
    path: activeTab?.entry.path ?? '',
    wordCount: activeTab ? countWords(activeTab.content) : 0,
  }
}
