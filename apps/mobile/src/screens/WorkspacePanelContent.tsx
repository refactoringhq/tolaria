import { useCallback } from 'react'
import type { TabletWorkspaceChromeState } from './TabletWorkspace'
import type { TabletWorkspaceChromeProps } from './tabletWorkspaceTypes'
import { TabletEditorPanelHost, TabletLeftChromeHost, TabletPropertiesPanelHost } from './TabletWorkspacePanels'

type Props = {
  workspace: TabletWorkspaceChromeProps
  chrome: TabletWorkspaceChromeState
}

export function WorkspacePanelContent({ workspace, chrome }: Props) {
  const blurEditor = chrome.editorCommandRegistry.commands.blur
  const onSelectNote = workspace.onSelectNote
  const selectNote = useCallback((noteId: string) => {
    blurEditor?.()
    onSelectNote(noteId)
  }, [blurEditor, onSelectNote])
  return (
    <>
      <TabletLeftChromeHost
        {...workspace}
        gestures={chrome.gestures}
        onOpenCommandPalette={chrome.openCommandPalette}
        onSelectNote={selectNote}
      />
      <TabletEditorPanelHost
        {...workspace}
        gestures={chrome.gestures}
        suggestionNotes={chrome.suggestionNotes}
        tableOfContentsTarget={chrome.tableOfContentsTarget}
        typeDefinitions={workspace.snapshot.typeDefinitions}
        onRegisterEditorCommands={chrome.editorCommandRegistry.register}
        onNavigateWikilink={chrome.handleNavigateWikilink}
      />
      <TabletPropertiesPanelHost
        {...workspace}
        gestures={chrome.gestures}
        onFixInvalidFrontmatter={chrome.editorCommandRegistry.commands.toggleRawEditor}
      />
    </>
  )
}
