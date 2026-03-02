import type { VaultEntry, GitCommit } from '../types'
import { Inspector, type FrontmatterValue } from './Inspector'
import { AiPanel } from './AiPanel'

interface EditorRightPanelProps {
  showAIChat?: boolean
  inspectorCollapsed: boolean
  inspectorWidth: number
  inspectorEntry: VaultEntry | null
  inspectorContent: string | null
  entries: VaultEntry[]
  allContent: Record<string, string>
  gitHistory: GitCommit[]
  vaultPath: string
  onToggleInspector: () => void
  onToggleAIChat?: () => void
  onNavigateWikilink: (target: string) => void
  onViewCommitDiff: (commitHash: string) => Promise<void>
  onUpdateFrontmatter?: (path: string, key: string, value: FrontmatterValue) => Promise<void>
  onDeleteProperty?: (path: string, key: string) => Promise<void>
  onAddProperty?: (path: string, key: string, value: FrontmatterValue) => Promise<void>
  onOpenNote?: (path: string) => void
}

export function EditorRightPanel({
  showAIChat, inspectorCollapsed, inspectorWidth,
  inspectorEntry, inspectorContent, entries, allContent, gitHistory, vaultPath,
  onToggleInspector, onToggleAIChat, onNavigateWikilink, onViewCommitDiff,
  onUpdateFrontmatter, onDeleteProperty, onAddProperty, onOpenNote,
}: EditorRightPanelProps) {
  if (showAIChat) {
    return (
      <div
        className="shrink-0 flex flex-col min-h-0"
        style={{ width: inspectorWidth, height: '100%' }}
      >
        <AiPanel
          onClose={() => onToggleAIChat?.()}
          onOpenNote={onOpenNote}
          vaultPath={vaultPath}
          activeEntry={inspectorEntry}
          entries={entries}
          allContent={allContent}
        />
      </div>
    )
  }

  if (inspectorCollapsed) return null

  return (
    <div
      className="shrink-0 flex flex-col min-h-0"
      style={{ width: inspectorWidth, height: '100%' }}
    >
      <Inspector
        collapsed={inspectorCollapsed}
        onToggle={onToggleInspector}
        entry={inspectorEntry}
        content={inspectorContent}
        entries={entries}
        allContent={allContent}
        gitHistory={gitHistory}
        onNavigate={onNavigateWikilink}
        onViewCommitDiff={onViewCommitDiff}
        onUpdateFrontmatter={onUpdateFrontmatter}
        onDeleteProperty={onDeleteProperty}
        onAddProperty={onAddProperty}
      />
    </div>
  )
}
