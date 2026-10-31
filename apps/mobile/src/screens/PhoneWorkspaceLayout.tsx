import type { ReactNode } from 'react'
import { View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { MobileWorkspaceEditNotice } from '../components/workspace/MobileWorkspaceEditNotice'
import type { MobileLayoutProbe } from '../qa/mobileLayoutProbe'
import { useMobileStyles } from '../ui/theme/useMobileTheme'
import type { useHorizontalSwipe } from '../ui/useHorizontalSwipe'
import type { useMobileEditorCommandRegistry } from '../workspace/mobileEditorCommands'
import type { MobileTableOfContentsTarget } from '../workspace/mobileTableOfContents'
import type { MobileNote } from '../workspace/mobileWorkspaceModel'
import type { PhoneWorkspaceNavigation } from './PhoneWorkspace'
import { PhoneWorkspaceScreens } from './PhoneWorkspaceScreens'
import { PhoneWorkspaceTransition } from './PhoneWorkspaceTransition'
import type { PhoneWorkspaceEditorOptions } from './phoneWorkspaceEditorOptions'
import type { PhonePanelRail, PhoneTableOfContentsTargetRequest, PhoneWorkspaceController } from './phoneWorkspaceScreenSupport'
import { createThemeStyles } from './phoneWorkspaceStyles'
import type { PhoneWorkspaceState } from './phoneWorkspaceTransitions'
import { WorkspaceActionSheetHost } from './TabletWorkspace'

type PhoneWorkspaceRootProps = {
  commandPaletteElement: ReactNode
  controller: PhoneWorkspaceController
  createRelationshipTargetAndOpenEditor: () => void
  panelRail: PhonePanelRail
  editorCommandRegistry: ReturnType<typeof useMobileEditorCommandRegistry>
  navigation: PhoneWorkspaceNavigation
  openCommandPalette: () => void
  options: PhoneWorkspaceEditorOptions
  phoneLayoutProbe: MobileLayoutProbe
  phoneState: PhoneWorkspaceState
  selectTableOfContentsTarget: (target: MobileTableOfContentsTarget) => void
  sourceModeRequest: number
  suggestionNotes: MobileNote[]
  tableOfContentsTarget: PhoneTableOfContentsTargetRequest | null
  transitionSwipeHandlers: ReturnType<typeof useHorizontalSwipe>
  onOpenNativeVault?: () => void
}

export function PhoneWorkspaceRoot(props: PhoneWorkspaceRootProps) {
  const { styles, mobileColors } = useMobileStyles(createThemeStyles)
  const insets = useSafeAreaInsets()
  const topColor = props.phoneState === 'sidebar' ? mobileColors.sidebar : mobileColors.card
  return (
    <View {...props.phoneLayoutProbe('phone.root')} style={styles.root}>
      {props.phoneState === 'editor' ? null : <View testID="phone-top-inset" style={{ height: insets.top, backgroundColor: topColor }} />}
      <PhoneWorkspaceContent {...props} />
      <MobileWorkspaceEditNotice retry={props.controller.retryFailedEdit} />
      <PhoneWorkspaceActions {...props} />
      {props.commandPaletteElement}
    </View>
  )
}

function PhoneWorkspaceContent(props: PhoneWorkspaceRootProps) {
  return (
    <PhoneWorkspaceTransition
      panelRail={props.panelRail}
      swipeHandlers={props.panelRail.enabled ? undefined : props.transitionSwipeHandlers}
    >
      <PhoneWorkspaceScreens
        controller={props.controller}
        options={props.options}
        openEditor={props.navigation.openEditor}
        openSourceEditor={props.navigation.openSourceEditor}
        openCommandPalette={props.openCommandPalette}
        openList={props.navigation.openList}
        openProperties={props.navigation.openProperties}
        openSidebar={props.navigation.openSidebar}
        phoneLayoutProbe={props.phoneLayoutProbe}
        phoneState={props.phoneState}
        onRegisterEditorCommands={props.editorCommandRegistry.register}
        sourceModeRequest={props.sourceModeRequest}
        toggleRawEditor={props.editorCommandRegistry.commands.toggleRawEditor ?? (() => {})}
        suggestionNotes={props.suggestionNotes}
        tableOfContentsTarget={props.tableOfContentsTarget}
      />
    </PhoneWorkspaceTransition>
  )
}

function PhoneWorkspaceActions(props: PhoneWorkspaceRootProps) {
  return (
    <WorkspaceActionSheetHost
      {...props.controller}
      editorCommands={props.editorCommandRegistry.commands}
      compactTablet
      defaultPropertiesVisible={false}
      initialEditorEditing={props.options.initialEditorEditing}
      layoutProbe={props.options.layoutProbe}
      suggestionNotes={props.suggestionNotes}
      onSelectNote={props.navigation.openEditor}
      onCreateRelationshipTarget={props.createRelationshipTargetAndOpenEditor}
      onEnterNeighborhood={props.navigation.openNeighborhoodList}
      onSelectTableOfContentsTarget={props.selectTableOfContentsTarget}
    />
  )
}
