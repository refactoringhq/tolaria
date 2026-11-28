import type { ComponentProps } from 'react'
import type { UpdateStatus } from '../hooks/useUpdater'
import { AiWorkspaceFloatingButton } from './AiWorkspaceFloatingButton'
import { LazyEditor } from './LazyEditor'
import { NoteList } from './NoteList'
import { PulseView } from './PulseView'
import { ResizeHandle } from './ResizeHandle'
import { Sidebar } from './Sidebar'
import { createWorkspaceList, editableNoteActions, type OpenNoteActionOptions, type WorkspaceListOptions } from './appWorkspacePaneProps'

interface PaneLayout {
  sidebarWidth: number
  noteListWidth: number
  handleSidebarResize: ComponentProps<typeof ResizeHandle>['onResize']
  handleNoteListResize: ComponentProps<typeof ResizeHandle>['onResize']
}

type SidebarProps = ComponentProps<typeof Sidebar>
type AiButtonProps = ComponentProps<typeof AiWorkspaceFloatingButton>

interface WorkspaceAiOptions extends Omit<AiButtonProps, 'defaultTarget' | 'providers' | 'updateBannerVisible'> {
  enabled: boolean
  updateState: UpdateStatus['state']
  defaultTarget?: AiButtonProps['defaultTarget'] | null
  providers?: AiButtonProps['providers'] | null
}

interface AppWorkspacePanesProps {
  desktopChrome: boolean
  collectionLayout: 'list' | 'kanban'
  noteOpen: boolean
  layout: PaneLayout
  hybridSidebar: boolean
  highlightedPane: string | null | undefined
  onCollapseSidebar: () => void
  desktopSidebar: boolean
  sidebar: Omit<SidebarProps, 'pluralizeTypeLabels'>
  pluralizeTypeLabels?: SidebarProps['pluralizeTypeLabels'] | null
  canReorderSavedViews: boolean
  list: WorkspaceListOptions
  editor: Omit<ComponentProps<typeof LazyEditor>, 'leftPanelsCollapsed' | 'onToggleAIChat'>
  noteActions: OpenNoteActionOptions
  ai: WorkspaceAiOptions
}

function WorkspaceSidebar({
  canReorderSavedViews, desktopSidebar, hybridSidebar, layout, list, onCollapseSidebar, pluralizeTypeLabels, sidebar,
}: Pick<AppWorkspacePanesProps,
  'canReorderSavedViews' | 'desktopSidebar' | 'hybridSidebar' | 'layout' | 'list' |
  'onCollapseSidebar' | 'pluralizeTypeLabels' | 'sidebar'
>) {
  if (!list.sidebarVisible) return null
  return (
    <>
      <div
        className={hybridSidebar ? 'app__sidebar dark' : 'app__sidebar'}
        data-theme={hybridSidebar ? 'dark' : undefined}
        style={{ width: layout.sidebarWidth }}
      >
        <Sidebar
          {...sidebar}
          workspaceHeader={desktopSidebar && sidebar.workspaceHeader}
          utilities={desktopSidebar && sidebar.utilities}
          onReorderViews={canReorderSavedViews ? sidebar.onReorderViews : undefined}
          pluralizeTypeLabels={pluralizeTypeLabels ?? true}
        />
      </div>
      <ResizeHandle onResize={layout.handleSidebarResize} collapse={{ label: 'sidebar.action.collapse', action: onCollapseSidebar }} />
    </>
  )
}

function WorkspaceNoteList({ highlightedPane, layout, list }: Pick<
  AppWorkspacePanesProps, 'highlightedPane' | 'layout' | 'list'
>) {
  const content = createWorkspaceList(list)
  if (!content) return null
  return (
    <>
      <div
        className={highlightedPane === 'notelist' ? 'app__note-list ai-highlight' : 'app__note-list'}
        style={{ width: layout.noteListWidth }}
      >
        {content.kind === 'pulse' ? <PulseView {...content.props} /> : <NoteList {...content.props} />}
      </div>
      <ResizeHandle onResize={layout.handleNoteListResize} />
    </>
  )
}

function WorkspaceEditor({ ai, editor, highlightedPane, list, noteActions }: Pick<
  AppWorkspacePanesProps, 'ai' | 'editor' | 'highlightedPane' | 'list' | 'noteActions'
>) {
  const highlightEditor = highlightedPane === 'editor' || highlightedPane === 'tab'
  return (
    <div className={highlightEditor ? 'app__editor ai-highlight' : 'app__editor'}>
      <LazyEditor
        {...editor}
        {...editableNoteActions(noteActions)}
        onToggleAIChat={ai.enabled ? ai.onOpen : undefined}
        leftPanelsCollapsed={!list.sidebarVisible && !list.visible}
      />
    </div>
  )
}

function WorkspaceAiLauncher({ visible, options }: { visible: boolean; options: WorkspaceAiOptions }) {
  const { defaultTarget, enabled, updateState, providers, ...button } = options
  if (!visible || !enabled) return null
  return (
    <AiWorkspaceFloatingButton
      {...button}
      defaultTarget={defaultTarget ?? undefined}
      providers={providers ?? []}
      updateBannerVisible={updateState !== 'idle' && updateState !== 'error'}
    />
  )
}

export function AppWorkspacePanes(props: AppWorkspacePanesProps) {
  const { ai, collectionLayout, desktopChrome, editor, highlightedPane, layout, list, noteOpen } = props
  return (
    <div
      className="app"
      data-desktop-sidebar-chrome={desktopChrome ? '' : undefined}
      data-collection-layout={collectionLayout}
      data-collection-note-open={noteOpen ? 'true' : 'false'}
    >
      <WorkspaceSidebar {...props} />
      <WorkspaceNoteList highlightedPane={highlightedPane} layout={layout} list={list} />
      <WorkspaceEditor {...props} />
      <WorkspaceAiLauncher visible={!editor.showAIChat} options={ai} />
    </div>
  )
}
