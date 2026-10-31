import type { MobileMetrics } from './mobileMetrics'
import { useMobileStyles } from './theme/useMobileTheme'
import type { MobileColors } from './theme/mobilePalette'
import type { ReactNode } from 'react'
import { Pressable, StyleSheet, View } from 'react-native'
import { Text } from '../components/ui/text'
import { probeProps, type MobileLayoutProbe } from '../qa/mobileLayoutProbe'

type MobileListRowProps = {
  chips?: ReactNode
  leading?: ReactNode
  layoutProbe?: MobileLayoutProbe
  meta?: string
  metricId?: string
  multiSelected?: boolean
  onLongPress?: () => void
  onPress?: () => void
  selected?: boolean
  selectedBackgroundColor?: string
  subtitle: string
  testID?: string
  title: string
  trailing?: ReactNode
}
type MobileListRowState = {
  accessibilitySelected: boolean
  desktopSelected: boolean
  multiSelected: boolean
}

export function MobileListRow(props: MobileListRowProps) {
  const themeStyles = useMobileStyles(createThemeStyles)
  const { styles } = themeStyles
  const rowState = mobileListRowState(props)

  return (
    <View
      {...rowProbeProps(props.layoutProbe, props.metricId, 'frame')}
      testID={props.testID}
      style={mobileListRowFrameStyle(themeStyles, props, rowState)}
    >
      <Pressable
        {...rowProbeProps(props.layoutProbe, props.metricId, 'body')}
        accessibilityState={{ selected: rowState.accessibilitySelected }}
        accessibilityRole="button"
        onLongPress={props.onLongPress}
        onPress={props.onPress}
        style={rowState.desktopSelected ? styles.baseSelected : styles.base}
      >
        <View {...rowProbeProps(props.layoutProbe, props.metricId, 'header')} style={styles.header}>
          {props.leading}
          <Text
            {...rowProbeProps(props.layoutProbe, props.metricId, 'title')}
            numberOfLines={1}
            style={[styles.title, rowState.desktopSelected ? styles.titleSelected : null]}
          >
            {props.title}
          </Text>
          {props.trailing}
        </View>
        <Text
          {...rowProbeProps(props.layoutProbe, props.metricId, 'subtitle')}
          numberOfLines={2}
          style={styles.subtitle}
        >
          {props.subtitle}
        </Text>
        <View {...rowProbeProps(props.layoutProbe, props.metricId, 'footer')} style={styles.footer}>
          {props.chips}
          {props.meta ? <Text style={styles.meta}>{props.meta}</Text> : null}
        </View>
      </Pressable>
    </View>
  )
}

function mobileListRowState(props: MobileListRowProps): MobileListRowState {
  const selected = props.selected ?? false
  const multiSelected = props.multiSelected ?? false

  return {
    accessibilitySelected: selected || multiSelected,
    desktopSelected: selected && !multiSelected,
    multiSelected,
  }
}

function mobileListRowFrameStyle(
  themeStyles: ReturnType<typeof createThemeStyles>,
  props: MobileListRowProps,
  state: MobileListRowState,
) {
  const { styles } = themeStyles
  return [
    styles.frame,
    state.desktopSelected ? styles.selected : null,
    state.multiSelected ? styles.multiSelected : mobileListRowSelectedColors(props, state),
  ]
}

function mobileListRowSelectedColors(props: MobileListRowProps, state: MobileListRowState) {
  return state.desktopSelected
    ? {
        backgroundColor: props.selectedBackgroundColor,
      }
    : null
}

function rowProbeProps(layoutProbe: MobileLayoutProbe | undefined, metricId: string | undefined, segment: string) {
  return metricId ? probeProps(layoutProbe, `${metricId}.${segment}`) : {}
}

function createThemeStyles(mobileColors: MobileColors, metrics: MobileMetrics) {
  const { noteItem: desktopNoteItemParity, space: mobileSpace } = metrics
  const baseContentStyle = {
    paddingBottom: desktopNoteItemParity.padding.bottom,
    paddingLeft: desktopNoteItemParity.padding.left,
    paddingRight: desktopNoteItemParity.padding.right,
    paddingTop: desktopNoteItemParity.padding.top,
  }
  const styles = StyleSheet.create({
    base: baseContentStyle,
    baseSelected: {
      ...baseContentStyle,
    },
    frame: {
      alignSelf: 'stretch',
      borderBottomColor: mobileColors.border,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderLeftColor: 'transparent',
      borderLeftWidth: 0,
      overflow: 'hidden',
      width: '100%',
    },
    footer: {
      marginTop: desktopNoteItemParity.contentGap,
      alignItems: 'center',
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: mobileSpace.sm,
    },
    header: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: mobileSpace.sm,
    },
    multiSelected: {
      backgroundColor: mobileColors.primarySoft,
    },
    selected: {
      borderLeftWidth: 0,
    },
    ...rowTextStyles(mobileColors, metrics),
  })
  return { mobileColors, styles }
}

function rowTextStyles(mobileColors: MobileColors, metrics: MobileMetrics) {
  const { noteItem: desktopNoteItemParity, type: mobileType } = metrics
  return StyleSheet.create({
    meta: {
      color: mobileColors.textMuted,
      fontSize: mobileType.caption,
    },
    subtitle: {
      marginTop: desktopNoteItemParity.contentGap,
      color: mobileColors.textMuted,
      fontSize: desktopNoteItemParity.snippetTextSize,
      lineHeight: desktopNoteItemParity.snippetLineHeight,
    },
    title: {
      flex: 1,
      color: mobileColors.text,
      fontSize: desktopNoteItemParity.titleTextSize,
      fontWeight: '500',
      lineHeight: desktopNoteItemParity.titleLineHeight,
    },
    titleSelected: {
      fontWeight: '600',
    },
  })
}
