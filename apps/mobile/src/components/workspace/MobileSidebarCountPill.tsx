import { Platform, StyleSheet, View } from 'react-native'
import { type MobileLayoutProbe, probeProps } from '../../qa/mobileLayoutProbe'
import type { MobileMetrics } from '../../ui/mobileMetrics'
import type { MobileColors } from '../../ui/theme/mobilePalette'
import { useMobileStyles } from '../../ui/theme/useMobileTheme'
import { Text } from '../ui/text'


type MobileSidebarCountPillProps = {
  activeColor?: string
  compact?: boolean
  plain?: boolean
  layoutProbe?: MobileLayoutProbe
  metricId?: string
  testID: string
  value: string
}

function NativeCountPill({
  activeColor,
  compact = false,
  plain = false,
  layoutProbe,
  metricId,
  testID,
  value,
}: MobileSidebarCountPillProps) {
  const { nativeStyles } = useMobileStyles(createThemeStyles)
  if (plain) {
    return (
      <Text
        {...countPillProbeProps(layoutProbe, metricId, 'text')}
        style={nativeStyles.plainText}
        testID={testID}
      >
        {value}
      </Text>
    )
  }
  return (
    <View
      {...countPillProbeProps(layoutProbe, metricId, 'container')}
      style={[compact ? nativeStyles.compact : nativeStyles.count, activeColor ? { backgroundColor: activeColor } : null]}
      testID={testID}
    >
      <Text
        {...countPillProbeProps(layoutProbe, metricId, 'text')}
        style={[nativeStyles.text, activeColor ? nativeStyles.activeText : null]}
      >
        {value}
      </Text>
    </View>
  )
}

function countPillProbeProps(
  layoutProbe: MobileLayoutProbe | undefined,
  metricId: string | undefined,
  segment: 'container' | 'text',
) {
  if (!layoutProbe || !metricId) return {}

  return probeProps(layoutProbe, `${metricId}.${segment}`)
}

function WebCountPill({
  activeColor,
  compact = false,
  plain = false,
  testID,
  value,
}: MobileSidebarCountPillProps) {
  const { webStyles, mobileColors } = useMobileStyles(createThemeStyles)
  if (plain) {
    return <Text style={webStyles.plainText} testID={testID}>{value}</Text>
  }
  return (
    <Text
      style={[compact ? webStyles.sectionCount : webStyles.count, activeColor ? { backgroundColor: activeColor, color: mobileColors.textInverse } : null]}
      testID={testID}
    >
      {value}
    </Text>
  )
}

export function MobileSidebarCountPill(props: MobileSidebarCountPillProps) {
  return Platform.OS === 'web' ? <WebCountPill {...props} /> : <NativeCountPill {...props} />
}

function createThemeStyles(mobileColors: MobileColors, metrics: MobileMetrics) {
  const { sidebar: desktopSidebarParity } = metrics
  const { pill, text, nativePill } = baseCountPillStyles(mobileColors, desktopSidebarParity)
  const plainText = plainCountTextStyles(mobileColors, metrics)
  const nativeStyles = StyleSheet.create({
    activeText: { color: mobileColors.textInverse },
    compact: {
      ...nativePill,
      minWidth: desktopSidebarParity.countPillCompactMinWidth,
      minHeight: desktopSidebarParity.countPillCompactHeight,
    },
    count: {
      ...nativePill,
      minWidth: desktopSidebarParity.countPillMinWidth,
      minHeight: desktopSidebarParity.countPillHeight,
    },
    text: {
      ...text,
      lineHeight: metrics.size(12),
    },
    plainText,
  })

  const webStyles = {
    count: {
      ...pill,
      ...text,
      minWidth: desktopSidebarParity.countPillMinWidth,
      height: desktopSidebarParity.countPillHeight,
    },
    sectionCount: {
      ...pill,
      ...text,
      minWidth: desktopSidebarParity.countPillCompactMinWidth,
      height: desktopSidebarParity.countPillCompactHeight,
    },
    plainText,
  }
  return { mobileColors, nativeStyles, webStyles }
}

function baseCountPillStyles(mobileColors: MobileColors, metrics: MobileMetrics['sidebar']) {
  const pill = {
    overflow: 'hidden' as const,
    borderRadius: metrics.countPillRadius,
    backgroundColor: mobileColors.graySoft,
    paddingHorizontal: metrics.countPillPaddingHorizontal,
  }
  const text = {
    color: mobileColors.textMuted,
    fontSize: metrics.countPillTextSize,
    fontWeight: '400' as const,
    textAlign: 'center' as const,
  }
  return {
    pill,
    text,
    nativePill: { ...pill, alignItems: 'center' as const, justifyContent: 'center' as const },
  }
}

function plainCountTextStyles(mobileColors: MobileColors, metrics: MobileMetrics) {
  return {
    color: mobileColors.textMuted,
    fontSize: metrics.phoneChrome.countTextSize,
    fontVariant: ['tabular-nums' as const],
    lineHeight: metrics.phoneChrome.sidebarTextLineHeight,
  }
}
