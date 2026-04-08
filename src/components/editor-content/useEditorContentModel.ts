import type React from 'react'
import { useEffect, useRef } from 'react'
import type { useCreateBlockNote } from '@blocknote/react'
import type { NoteStatus, VaultEntry } from '../../types'
import { useEditorTheme } from '../../hooks/useTheme'
import { resolveNoteIcon } from '../../utils/noteIcon'
import { deriveEditorContentState } from './editorContentState'

export interface Tab {
  entry: VaultEntry
  content: string
}

export interface EditorContentProps {
  activeTab: Tab | null
  isLoadingNewTab: boolean
  entries: VaultEntry[]
  editor: ReturnType<typeof useCreateBlockNote>
  diffMode: boolean
  diffContent: string | null
  diffLoading: boolean
  onToggleDiff: () => void
  rawMode: boolean
  onToggleRaw: () => void
  onRawContentChange?: (path: string, content: string) => void
  onSave?: () => void
  activeStatus: NoteStatus
  showDiffToggle: boolean
  showAIChat?: boolean
  onToggleAIChat?: () => void
  inspectorCollapsed: boolean
  onToggleInspector: () => void
  onNavigateWikilink: (target: string) => void
  onEditorChange?: () => void
  onToggleFavorite?: (path: string) => void
  onToggleOrganized?: (path: string) => void
  onDeleteNote?: (path: string) => void
  onArchiveNote?: (path: string) => void
  onUnarchiveNote?: (path: string) => void
  vaultPath?: string
  rawLatestContentRef?: React.MutableRefObject<string | null>
  onTitleChange?: (path: string, newTitle: string) => void
  isConflicted?: boolean
  onKeepMine?: (path: string) => void
  onKeepTheirs?: (path: string) => void
}

export function useEditorContentModel(props: EditorContentProps) {
  const {
    activeTab,
    entries,
    rawMode,
    activeStatus,
    diffMode,
  } = props

  const { cssVars } = useEditorTheme()
  const {
    isArchived,
    isDeletedPreview,
    isNonMarkdownText,
    effectiveRawMode,
    showEditor: showContentEditor,
    path,
    showTitleSection,
    wordCount,
  } = deriveEditorContentState({
    activeTab,
    entries,
    rawMode,
    activeStatus,
  })
  const showEditor = !diffMode && showContentEditor
  const entryIcon = activeTab?.entry.icon ?? null
  const hasDisplayIcon = resolveNoteIcon(entryIcon).kind !== 'none'

  const titleSectionRef = useRef<HTMLDivElement | null>(null)
  const breadcrumbBarRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!showEditor) return

    const bar = breadcrumbBarRef.current
    const titleSection = titleSectionRef.current
    if (!bar || !titleSection) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) bar.removeAttribute('data-title-hidden')
        else bar.setAttribute('data-title-hidden', '')
      },
      { threshold: 0 },
    )
    observer.observe(titleSection)
    return () => {
      observer.disconnect()
      bar.removeAttribute('data-title-hidden')
    }
  }, [path, showEditor])

  return {
    ...props,
    cssVars,
    isArchived,
    isDeletedPreview,
    effectiveRawMode,
    forceRawMode: isNonMarkdownText || isDeletedPreview,
    showEditor,
    entryIcon,
    hasDisplayIcon,
    path,
    showTitleSection,
    titleSectionRef,
    breadcrumbBarRef,
    wordCount,
  }
}
