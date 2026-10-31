import { Platform, StyleSheet } from 'react-native'
import type { MobileMetrics } from '../../ui/mobileMetrics'
import type { MobileColors } from '../../ui/theme/mobilePalette'

export function createSidebarStyles(mobileColors: MobileColors, metrics: MobileMetrics) {
  const nativeStyles = StyleSheet.create({
    itemText: { lineHeight: metrics.size(18) },
    sectionTitleRow: { minHeight: metrics.size(30) },
    sectionTitle: { lineHeight: metrics.size(14) },
  })
  const phoneStyles = createPhoneStyles(mobileColors, metrics)
  const panelStyles = createPanelStyles(mobileColors, metrics)
  const itemStyles = createItemStyles(mobileColors, metrics)
  const sectionTitleStyles = createSectionTitleStyles(mobileColors, metrics)
  return {
    mobileColors, metrics, panelStyles, itemStyles, sectionTitleStyles,
    styles: { ...panelStyles, ...itemStyles, ...sectionTitleStyles },
    nativeItemTextStyle: Platform.OS === 'web' ? null : nativeStyles.itemText,
    phoneItemStyle: phoneStyles.phoneItem,
    phoneItemContentStyle: phoneStyles.phoneItemContent,
    phoneItemTextStyle: phoneStyles.phoneItemText,
    phoneCountTextStyle: phoneStyles.phoneCountText,
    nativeSectionTitleRowStyle: Platform.OS === 'web' ? null : nativeStyles.sectionTitleRow,
    nativeSectionTitleTextStyle: Platform.OS === 'web' ? null : nativeStyles.sectionTitle,
  }
}

function createPhoneStyles(mobileColors: MobileColors, metrics: MobileMetrics) {
  const phone = metrics.phoneChrome
  return StyleSheet.create({
    phoneItem: { minHeight: phone.sidebarRowHeight, paddingHorizontal: phone.rowHorizontalPadding, paddingVertical: 0 },
    phoneItemContent: { minHeight: phone.sidebarRowHeight },
    phoneItemText: { fontSize: phone.sidebarTextSize, lineHeight: phone.sidebarTextLineHeight },
    phoneCountText: {
      color: mobileColors.textMuted,
      fontSize: phone.countTextSize,
      lineHeight: phone.sidebarTextLineHeight,
      fontVariant: ['tabular-nums'],
    },
  })
}

function createPanelStyles(colors: MobileColors, metrics: MobileMetrics) {
  const { sidebar, panel, type } = metrics
  return StyleSheet.create({
    content: { padding: 0 },
    scroll: { flex: 1 },
    floatingControls: { position: 'absolute', bottom: 0, left: 0, right: 0 },
    groupSection: { paddingHorizontal: sidebar.sectionHorizontalPadding },
    panel: {
      alignSelf: 'stretch', width: panel.sidebarWidth, height: '100%',
      backgroundColor: colors.sidebar, borderRightWidth: StyleSheet.hairlineWidth,
    },
    fullWidth: { width: '100%' },
    primarySection: {
      paddingBottom: sidebar.topNavPadding.bottom, paddingLeft: sidebar.topNavPadding.left,
      paddingRight: sidebar.topNavPadding.right, paddingTop: sidebar.topNavPadding.top,
    },
    section: { borderBottomColor: colors.border, borderBottomWidth: StyleSheet.hairlineWidth },
    toolbarActions: { marginLeft: 'auto' },
    vaultTitle: { flex: 1, color: colors.text, fontSize: type.body, fontWeight: '600' },
  })
}

function createItemStyles(colors: MobileColors, metrics: MobileMetrics) {
  const { sidebar } = metrics
  return StyleSheet.create({
    item: {
      justifyContent: 'center', borderRadius: sidebar.itemRadius, width: '100%',
      minHeight: sidebar.itemContentHeight.regular + sidebar.itemPadding.regular.top + sidebar.itemPadding.regular.bottom,
    },
    itemContent: { alignItems: 'center', flexDirection: 'row', gap: sidebar.itemGap },
    itemPressed: { backgroundColor: colors.control },
    itemText: { flex: 1, color: colors.text, fontSize: sidebar.itemTextSize, fontWeight: '500' },
  })
}

function createSectionTitleStyles(colors: MobileColors, metrics: MobileMetrics) {
  const { sidebar, space } = metrics
  return StyleSheet.create({
    sectionTitle: {
      flex: 1, color: colors.textMuted, fontSize: sidebar.countPillTextSize,
      fontWeight: sidebar.sectionTitleFontWeight, letterSpacing: sidebar.sectionTitleLetterSpacing,
    },
    sectionTitleRow: { alignItems: 'center', flexDirection: 'row', gap: space.xs },
    sectionTitleToggle: { flex: 1, minWidth: 0, alignSelf: 'stretch', alignItems: 'center', flexDirection: 'row', gap: space.xs },
    sectionTitleRowStacked: { flexWrap: 'wrap' },
    sectionTitleActions: { alignItems: 'center', flexDirection: 'row', gap: space.xs },
    sectionTitleActionsStacked: { width: '100%', justifyContent: 'flex-end' },
    sectionTitleRowRegular: {
      paddingBottom: sidebar.groupHeaderPadding.regular.bottom,
      paddingLeft: sidebar.groupHeaderPadding.regular.left,
      paddingRight: sidebar.groupHeaderPadding.regular.right,
      paddingTop: sidebar.groupHeaderPadding.regular.top,
    },
    sectionTitleRowWithCount: {
      paddingBottom: sidebar.groupHeaderPadding.withCount.bottom,
      paddingLeft: sidebar.groupHeaderPadding.withCount.left,
      paddingRight: sidebar.groupHeaderPadding.withCount.right,
      paddingTop: sidebar.groupHeaderPadding.withCount.top,
    },
  })
}
