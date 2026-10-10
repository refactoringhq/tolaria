import { ScrollView, StyleSheet, View } from 'react-native'
import { mobileText } from '../../i18n/mobileText'
import { MobileIconButton } from '../../ui/MobileIconButton'
import { desktopToolbarActionParity } from '../../ui/desktopParity'
import { mobileColors, mobileSpace } from '../../ui/tokens'
import { probeProps, type MobileLayoutProbe } from '../../qa/mobileLayoutProbe'
import type { MobileMarkdownFormatAction } from '../../workspace/mobileMarkdownFormatting'

import { formattingCommands } from './mobileFormattingCommands'

const nativeOnlyFormattingActions = new Set<MobileMarkdownFormatAction>([
  'tableAddColumnAfter',
  'tableAddRowAfter',
  'tableDeleteColumn',
  'tableDeleteRow',
])

const sourceMarkdownFormattingActions = formattingCommands
  .map((command) => command.action)
  .filter((action) => !nativeOnlyFormattingActions.has(action))

export function MobileMarkdownFormattingToolbar({
  actions,
  layoutProbe,
  metricId,
  onFormat,
}: {
  actions?: readonly MobileMarkdownFormatAction[]
  layoutProbe?: MobileLayoutProbe
  metricId?: string
  onFormat: (action: MobileMarkdownFormatAction) => void
}) {
  const visibleActions = new Set(actions ?? sourceMarkdownFormattingActions)

  return (
    <ScrollView
      accessibilityLabel={mobileText('editor.formatting.toolbar')}
      alwaysBounceHorizontal={false}
      contentContainerStyle={styles.toolbarContent}
      horizontal
      keyboardShouldPersistTaps="handled"
      {...formattingProbeProps(layoutProbe, metricId)}
      showsHorizontalScrollIndicator={false}
      style={styles.toolbarViewport}
      testID="editor-formatting-toolbar"
    >
      {formattingCommands.filter((command) => visibleActions.has(command.action)).map((command) => (
        <View
          key={command.action}
          {...formattingProbeProps(layoutProbe, metricId, `action.${command.action}`)}
          style={styles.actionProbe}
        >
          <MobileIconButton
            accessibilityLabel={command.label}
            testID={command.testID}
            onPress={() => onFormat(command.action)}
          >
            {command.icon(mobileColors.textMuted)}
          </MobileIconButton>
        </View>
      ))}
    </ScrollView>
  )
}

function formattingProbeProps(
  layoutProbe: MobileLayoutProbe | undefined,
  metricId: string | undefined,
  segment?: string,
) {
  if (!layoutProbe || !metricId) return {}
  return probeProps(layoutProbe, segment ? `${metricId}.${segment}` : metricId)
}

const styles = StyleSheet.create({
  actionProbe: {
    height: desktopToolbarActionParity.iconButtonSize,
    width: desktopToolbarActionParity.iconButtonSize,
  },
  toolbarContent: {
    flexDirection: 'row',
    gap: mobileSpace.xs,
    paddingBottom: mobileSpace.xs,
  },
  toolbarViewport: {
    flexGrow: 0,
  },
})
