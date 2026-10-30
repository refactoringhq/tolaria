import type { MobileMetrics } from './mobileMetrics'
import { useMobileStyles } from './theme/useMobileTheme'
import type { MobileColors } from './theme/mobilePalette'
import type { ReactNode } from 'react'
import { StyleSheet, View, type StyleProp, type ViewProps, type ViewStyle } from 'react-native'
import { Text } from '../components/ui/text'


type MobileToolbarTitleVariant = 'default' | 'inspector'

export function MobilePanel({
  children,
  style,
  testID,
  ...viewProps
}: ViewProps & {
  children: ReactNode
  style?: StyleProp<ViewStyle>
  testID?: string
}) {
  const { styles } = useMobileStyles(createThemeStyles)
  return <View {...viewProps} style={[styles.panel, style]} testID={testID}>{children}</View>
}

export function MobileToolbar({
  children,
  testID,
}: {
  children: ReactNode
  testID?: string
}) {
  const { styles } = useMobileStyles(createThemeStyles)
  return <View style={styles.toolbar} testID={testID}>{children}</View>
}

export function MobileToolbarTitle({
  testID,
  title,
  variant = 'default',
}: {
  testID?: string
  title: string
  variant?: MobileToolbarTitleVariant
}) {
  const { titleStyleByVariant } = useMobileStyles(createThemeStyles)
  return <Text numberOfLines={1} style={titleStyleByVariant[variant]} testID={testID}>{title}</Text>
}

export function MobileToolbarSpacer() {
  const { styles } = useMobileStyles(createThemeStyles)
  return <View style={styles.spacer} />
}

function createThemeStyles(mobileColors: MobileColors, metrics: MobileMetrics) {
  const { toolbar: desktopToolbarParity, panel: desktopPanelParity, noteItem } = metrics
  const styles = StyleSheet.create({
    panel: {
      minWidth: 0,
      backgroundColor: mobileColors.card,
      borderColor: mobileColors.border,
    },
    spacer: {
      flex: 1,
    },
    title: {
      flexShrink: 1,
      minWidth: 0,
      color: mobileColors.text,
      fontSize: desktopToolbarParity.titleFontSize,
      fontWeight: desktopToolbarParity.titleFontWeight,
    },
    titleInspector: {
      color: mobileColors.textMuted,
      fontSize: desktopToolbarParity.inspectorTitleFontSize,
      fontWeight: desktopToolbarParity.titleFontWeight,
    },
    toolbar: {
      minHeight: desktopPanelParity.toolbarHeight,
      alignItems: 'center',
      flexDirection: 'row',
      gap: desktopToolbarParity.gap,
      borderBottomColor: mobileColors.border,
      borderBottomWidth: StyleSheet.hairlineWidth,
      paddingHorizontal: noteItem.padding.left,
    },
  })

  const titleStyleByVariant = {
    default: styles.title,
    inspector: styles.titleInspector,
  } as const
  return { mobileColors, styles, titleStyleByVariant }
}
