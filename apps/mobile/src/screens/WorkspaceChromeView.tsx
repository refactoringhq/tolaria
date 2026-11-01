import { MobileCommandPalette } from '../components/workspace/MobileCommandPalette'
import { WorkspaceActionSheetHost } from './TabletWorkspaceActionSheetHost'
import { GestureDetector } from 'react-native-gesture-handler'
import { View } from 'react-native'
import { WorkspacePanelContent } from './WorkspacePanelContent'
import type { TabletWorkspaceChromeState } from './TabletWorkspace'
import type { TabletWorkspaceChromeProps } from './tabletWorkspaceTypes'
import type { createTabletWorkspaceStyles } from './TabletWorkspaceStyles'

type Props = {
  workspace: TabletWorkspaceChromeProps
  chrome: TabletWorkspaceChromeState
  styles: ReturnType<typeof createTabletWorkspaceStyles>['styles']
}

export function TabletWorkspaceChromeView({ workspace, chrome, styles }: Props) {
  return (
    <GestureDetector gesture={chrome.gestures.panGesture}>
      <View collapsable={false} style={styles.shell} testID="tablet-workspace-gesture-surface">
        <WorkspacePanelContent workspace={workspace} chrome={chrome} />
        <WorkspaceActionSheetHost
          {...workspace}
          editorCommands={chrome.editorCommandRegistry.commands}
          suggestionNotes={chrome.suggestionNotes}
          onSelectTableOfContentsTarget={chrome.handleSelectTableOfContentsTarget}
        />
        {chrome.commandPaletteOpen && (
          <MobileCommandPalette commands={chrome.commandPaletteCommands} onClose={chrome.closeCommandPalette} />
        )}
      </View>
    </GestureDetector>
  )
}
