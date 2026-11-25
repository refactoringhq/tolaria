import type { NoteWidthMode, VaultEntry } from '../../types'
import type { AppLocale } from '../../lib/i18n'

export interface BreadcrumbBarProps {
  entry: VaultEntry
  wordCount: number
  showDiffToggle: boolean
  diffMode: boolean
  diffLoading: boolean
  onToggleDiff: () => void
  rawMode?: boolean
  onToggleRaw?: () => void
  /** When true, raw mode is forced (non-markdown file) — hide the toggle. */
  forceRawMode?: boolean
  showAIChat?: boolean
  onToggleAIChat?: () => void
  showTableOfContents?: boolean
  onToggleTableOfContents?: () => void
  inspectorCollapsed?: boolean
  onToggleInspector?: () => void
  onToggleFavorite?: () => void
  onToggleOrganized?: () => void
  onRevealFile?: (path: string) => void
  onCopyFilePath?: (path: string) => void
  onCopyDeepLink?: (entry: VaultEntry) => void
  onCopyGitUrl?: (entry: VaultEntry) => void
  onExportPdf?: () => void
  onDelete?: () => void
  onArchive?: () => void
  onUnarchive?: () => void
  onEnterNeighborhood?: (entry: VaultEntry) => void
  onRenameFilename?: (path: string, newFilenameStem: string) => void
  noteWidth?: NoteWidthMode
  onToggleNoteWidth?: () => void
  /** Ref for direct DOM manipulation — avoids re-render on scroll. */
  barRef?: React.Ref<HTMLDivElement>
  locale?: AppLocale
  loadingTitle?: boolean
  content?: string | null
}
