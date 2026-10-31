import type { ReactNode } from 'react'
import { Platform, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native'
import { Text } from '../components/ui/text'
import { type MobileLayoutProbe, probeProps } from '../qa/mobileLayoutProbe'
import { isPhoneViewport, type MobileMetrics } from './mobileMetrics'
import type { MobileColors } from './theme/mobilePalette'
import { useMobileStyles } from './theme/useMobileTheme'

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
  const isPhone = isPhoneViewport(useWindowDimensions().width, Platform.OS === 'ios' && Platform.isPad)
  const rowState = mobileListRowState(props)

  return (
    <View
      {...rowProbeProps(props.layoutProbe, props.metricId, 'frame')}
      testID={props.testID}
      style={mobileListRowFrameStyle(themeStyles, props, rowState)}
    >
      <MobileListRowBody isPhone={isPhone} props={props} rowState={rowState} styles={themeStyles.styles} />
    </View>
  )
}

function MobileListRowBody({
  isPhone,
  props,
  rowState,
  styles,
}: {
  isPhone: boolean
  props: MobileListRowProps
  rowState: MobileListRowState
  styles: ReturnType<typeof createThemeStyles>['styles']
}) {
  return (
    <Pressable
      {...rowProbeProps(props.layoutProbe, props.metricId, 'body')}
      accessibilityState={{ selected: rowState.accessibilitySelected }}
      accessibilityRole="button"
      onLongPress={props.onLongPress}
      onPress={props.onPress}
      style={[rowState.desktopSelected ? styles.baseSelected : styles.base, isPhone ? styles.phoneBase : null]}
    >
      <View {...rowProbeProps(props.layoutProbe, props.metricId, 'header')} style={styles.header}>
        {props.leading}
        <Text
          {...rowProbeProps(props.layoutProbe, props.metricId, 'title')}
          numberOfLines={1}
          style={[styles.title, isPhone ? styles.phoneTitle : null, rowState.desktopSelected ? styles.titleSelected : null]}
        >
          {props.title}
        </Text>
        {props.trailing}
      </View>
      <Text
        {...rowProbeProps(props.layoutProbe, props.metricId, 'subtitle')}
        numberOfLines={2}
        style={[styles.subtitle, isPhone ? styles.phoneSubtitle : null]}
      >
        {props.subtitle}
      </Text>
      <MobileListRowFooter props={props} styles={styles} />
    </Pressable>
  )
}

function MobileListRowFooter({ props, styles }: { props: MobileListRowProps; styles: ReturnType<typeof createThemeStyles>['styles'] }) {
  return (
    <View {...rowProbeProps(props.layoutProbe, props.metricId, 'footer')} style={styles.footer}>
      {props.chips}
      {props.meta ? <Text style={styles.meta}>{props.meta}</Text> : null}
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
    phoneBase: {
      ...phoneRowBaseStyle(metrics),
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
    ...phoneRowTextStyles(metrics),
  })
  return { mobileColors, styles }
}

function phoneRowBaseStyle(metrics: MobileMetrics) {
  const phone = metrics.phoneChrome
  return {
    minHeight: phone.noteRowMinHeight,
    paddingBottom: phone.noteRowPaddingVertical,
    paddingHorizontal: phone.rowHorizontalPadding,
    paddingTop: phone.noteRowPaddingVertical,
  }
}

function phoneRowTextStyles(metrics: MobileMetrics) {
  const phone = metrics.phoneChrome
  return {
    phoneTitle: {
      fontSize: phone.noteTitleTextSize,
      lineHeight: phone.noteTitleLineHeight,
    },
    phoneSubtitle: {
      marginTop: phone.noteSnippetMarginTop,
      fontSize: phone.noteSnippetTextSize,
      lineHeight: phone.noteSnippetLineHeight,
    },
  }
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
