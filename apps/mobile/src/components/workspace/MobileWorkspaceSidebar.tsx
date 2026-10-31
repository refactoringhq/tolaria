import {
  CaretDown,
  CaretRight,
  Eye,
  FileText,
  Plus,
} from 'phosphor-react-native'
import { type ReactNode, useCallback, useState } from 'react'
import { type LayoutChangeEvent, Platform, Pressable, ScrollView, useWindowDimensions, View } from 'react-native'
import { mobileCopy, mobileText } from '../../i18n/mobileText'
import { MobileLayoutProbeReadout } from '../../qa/MobileLayoutProbeReadout'
import { type MobileLayoutProbe, probeProps, useMobileLayoutProbe } from '../../qa/mobileLayoutProbe'
import { MobileIconButton } from '../../ui/MobileIconButton'
import { MobilePanel, MobileToolbar } from '../../ui/MobilePanel'
import { isPhoneViewport, type MobileMetrics, phoneViewportStyle } from '../../ui/mobileMetrics'
import { useMobileStyles } from '../../ui/theme/useMobileTheme'
import type {
  MobileNote,
  MobileSidebarIcon,
  MobileSidebarItem,
  MobileSidebarSection,
} from '../../workspace/mobileWorkspaceModel'
import { Text } from '../ui/text'
import { MobileVaultPicker } from '../vaults/MobileVaultPicker'
import { MobileSidebarCountPill } from './MobileSidebarCountPill'
import { MobileSidebarSettings } from './MobileSidebarSettings'
import { mobilePhosphorIconElement } from './MobileWorkspaceIconResolver'
import { FolderTree, type MobileSidebarFolderSelection } from './MobileWorkspaceSidebarFolderTree'
import { createSidebarStyles as createThemeStyles } from './mobileSidebarStyles'
import { noteTypeColor, noteTypeSoftColor } from './mobileWorkspaceTone'

export type { MobileSidebarFolderSelection } from './MobileWorkspaceSidebarFolderTree'

export type MobileSidebarItemSelection = {
  count?: string
  id: string
  label: string
  noteId?: string
  sectionId: string
  typeName?: string
  viewId?: string
}

type SidebarDisplayLabel = string
type SidebarItemId = string
type SidebarMetricId = string
type SidebarSectionId = string
type SidebarSlug = string
type SidebarSelectionHandler = NonNullable<MobileWorkspaceSidebarProps['onSelectItem']>

type MobileWorkspaceSidebarProps = {
  activeFolderId?: string | null
  activeItemId?: string | null
  layoutProbe?: boolean
  fullWidth?: boolean
  onCreateFolder?: () => void
  onCreateType?: () => void
  onCreateView?: () => void
  onOpenFolderActions?: (selection: MobileSidebarFolderSelection) => void
  onOpenFavoriteActions?: (selection: MobileSidebarItemSelection) => void
  onOpenCommandPalette?: () => void
  onOpenPrimaryActions?: (selection: MobileSidebarItemSelection) => void
  onOpenTypeVisibility?: () => void
  onOpenTypeActions?: (selection: MobileSidebarItemSelection) => void
  onOpenViewActions?: (selection: MobileSidebarItemSelection) => void
  onSelectFolder?: (selection: MobileSidebarFolderSelection) => void
  onSelectItem?: (selection: MobileSidebarItemSelection) => void
  sections: MobileSidebarSection[]
  title?: string
}

type SidebarItemProps = {
  active?: boolean
  activeBackgroundColor?: string
  activeColor?: string
  count?: string
  icon: ReactNode
  label: SidebarDisplayLabel
  layoutProbe?: MobileLayoutProbe
  metricId: SidebarMetricId
  onLongPress?: () => void
  onPress?: () => void
  slug: SidebarSlug
}

export function MobileWorkspaceSidebar(props: MobileWorkspaceSidebarProps) {
  const { styles } = useMobileStyles(createThemeStyles)
  const layoutProbe = useMobileLayoutProbe(props.layoutProbe ?? false)
  const [controlsHeight, setControlsHeight] = useState(0)
  const measureControls = useCallback((event: LayoutChangeEvent) => setControlsHeight(event.nativeEvent.layout.height), [])
  return (
    <MobilePanel {...layoutProbe.probe('sidebar.panel')} style={[styles.panel, props.fullWidth && styles.fullWidth]} testID="workspace-sidebar-panel">
      <SidebarToolbar title={props.title} />
      <ScrollView {...layoutProbe.probe('sidebar.scroll')} testID="sidebar-scroll" style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingBottom: controlsHeight }]} scrollIndicatorInsets={{ bottom: controlsHeight }}>
        {props.sections.map((section) => (
          <SidebarSection {...props} key={section.id} layoutProbe={layoutProbe.probe} section={section} />
        ))}
      </ScrollView>
      <View pointerEvents="box-none" style={styles.floatingControls} onLayout={measureControls} testID="sidebar-floating-controls">
        <MobileSidebarSettings onOpenCommandPalette={props.onOpenCommandPalette} />
      </View>
      {props.layoutProbe ? <MobileLayoutProbeReadout metrics={layoutProbe.metrics} testID="sidebar-layout-metrics" /> : null}
    </MobilePanel>
  )
}

function SidebarToolbar({ title }: Pick<MobileWorkspaceSidebarProps, 'title'>) {
  const { styles } = useMobileStyles(createThemeStyles)
  return (
      <MobileToolbar testID="sidebar-toolbar">
        <Text numberOfLines={1} style={styles.vaultTitle} testID="sidebar-toolbar-title">{title ?? mobileText('status.vault.default')}</Text>
        <View style={styles.toolbarActions}><MobileVaultPicker /></View>
      </MobileToolbar>
  )
}

type SidebarSectionProps = Omit<MobileWorkspaceSidebarProps, 'layoutProbe'> & {
  layoutProbe: MobileLayoutProbe
  section: MobileSidebarSection
}

function SidebarSection(props: SidebarSectionProps) {
  const { styles } = useMobileStyles(createThemeStyles)
  const { layoutProbe, section } = props
  const [expanded, setExpanded] = useState(true)
  return (
    <View
      {...probeProps(layoutProbe, `sidebar.section.${section.id}.container`)}
      style={[styles.section, section.id === 'primary' ? styles.primarySection : styles.groupSection]}
      testID={`sidebar-section-${section.id}`}
    >
      <SidebarSectionTitle {...props} expanded={expanded} onToggle={() => setExpanded(value => !value)} />
      {expanded && <SidebarSectionItems {...props} />}
      {expanded && section.folders ? (
        <FolderTree
          activeFolderId={props.activeFolderId}
          folders={section.folders}
          layoutProbe={layoutProbe}
          onOpenFolderActions={props.onOpenFolderActions}
          onSelectFolder={props.onSelectFolder}
        />
      ) : null}
    </View>
  )
}

function SidebarSectionTitle(props: {
  expanded: boolean
  layoutProbe: MobileLayoutProbe
  onCreateFolder?: () => void
  onCreateType?: () => void
  onCreateView?: () => void
  onOpenTypeVisibility?: () => void
  onToggle: () => void
  section: MobileSidebarSection
}) {
  const { expanded, layoutProbe, onCreateFolder, onCreateType, onCreateView, onOpenTypeVisibility, onToggle, section } = props
  if (!section.label) return null

  return (
    <SectionTitle
      expanded={expanded}
      onToggle={onToggle}
      count={section.id === 'types' ? undefined : section.count}
      label={sidebarSectionLabel(section.id, section.label)}
      layoutProbe={layoutProbe}
      sectionId={section.id}
      createAccessibilityLabel={sectionCreateAccessibilityLabel(section.id)}
      onCreate={sectionCreateHandler(section.id, onCreateFolder, onCreateType, onCreateView)}
      visibilityAccessibilityLabel={sectionVisibilityAccessibilityLabel(section.id)}
      onVisibility={sectionVisibilityHandler(section.id, onOpenTypeVisibility)}
    />
  )
}

function sectionVisibilityAccessibilityLabel(sectionId: SidebarSectionId) {
  if (sectionId === 'types') return mobileText('sidebar.section.showInSidebar')
  return undefined
}

function sectionVisibilityHandler(
  sectionId: SidebarSectionId,
  onOpenTypeVisibility?: () => void,
) {
  if (sectionId === 'types') return onOpenTypeVisibility
  return undefined
}

function sectionCreateAccessibilityLabel(sectionId: SidebarSectionId) {
  if (sectionId === 'folders') return mobileText('sidebar.action.createFolder')
  if (sectionId === 'types') return mobileText('sidebar.action.createType')
  if (sectionId === 'views') return mobileText('sidebar.action.createView')
  return undefined
}

function sectionCreateHandler(
  sectionId: SidebarSectionId,
  onCreateFolder?: () => void,
  onCreateType?: () => void,
  onCreateView?: () => void,
) {
  if (sectionId === 'folders') return onCreateFolder
  if (sectionId === 'types') return onCreateType
  if (sectionId === 'views') return onCreateView
  return undefined
}

function SidebarSectionItems(props: SidebarSectionProps) {
  const { activeItemId, layoutProbe, onSelectItem, section } = props
  const themeStyles = useMobileStyles(createThemeStyles)
  return section.items?.map((item) => {
    const active = activeItemId ? item.id === activeItemId : item.active
    const label = sidebarLabel(item.id, item.label)
    const selection = sidebarItemSelection(item, label, section.id)

    return (
      <SidebarItem
        active={active}
        activeBackgroundColor={sidebarActiveBackgroundColor(themeStyles, item.tone)}
        activeColor={sidebarActiveColor(themeStyles, item.tone)}
        count={item.count}
        icon={sidebarIcon(themeStyles, item.icon, active ? item.tone ?? 'primary' : item.tone)}
        key={item.id}
        label={label}
        layoutProbe={layoutProbe}
        metricId={`sidebar.item.${item.id}`}
        slug={item.id}
        onLongPress={sidebarItemLongPress({
          onOpenPrimaryActions: props.onOpenPrimaryActions,
          onOpenTypeActions: props.onOpenTypeActions,
          onOpenViewActions: props.onOpenViewActions,
          onOpenFavoriteActions: props.onOpenFavoriteActions,
          sectionId: section.id,
          selection,
        })}
        onPress={() => onSelectItem?.(selection)}
      />
    )
  }) ?? null
}

function sidebarItemLongPress({
  onOpenPrimaryActions,
  onOpenTypeActions,
  onOpenViewActions,
  onOpenFavoriteActions,
  sectionId,
  selection,
}: {
  onOpenPrimaryActions?: (selection: MobileSidebarItemSelection) => void
  onOpenTypeActions?: (selection: MobileSidebarItemSelection) => void
  onOpenViewActions?: (selection: MobileSidebarItemSelection) => void
  onOpenFavoriteActions?: (selection: MobileSidebarItemSelection) => void
  sectionId: SidebarSectionId
  selection: MobileSidebarItemSelection
}) {
  const handler = sidebarLongPressHandler({
    onOpenFavoriteActions,
    onOpenPrimaryActions,
    onOpenTypeActions,
    onOpenViewActions,
    sectionId,
    selection,
  })

  return handler ? () => handler(selection) : undefined
}

function sidebarLongPressHandler({
  onOpenFavoriteActions,
  onOpenPrimaryActions,
  onOpenTypeActions,
  onOpenViewActions,
  sectionId,
  selection,
}: {
  onOpenFavoriteActions?: SidebarSelectionHandler
  onOpenPrimaryActions?: SidebarSelectionHandler
  onOpenTypeActions?: SidebarSelectionHandler
  onOpenViewActions?: SidebarSelectionHandler
  sectionId: SidebarSectionId
  selection: MobileSidebarItemSelection
}): SidebarSelectionHandler | undefined {
  if (sectionId === 'primary') return primaryItemCanCustomizeColumns(selection.id) ? onOpenPrimaryActions : undefined

  const handlers: Partial<Record<SidebarSectionId, SidebarSelectionHandler | undefined>> = {
    favorites: onOpenFavoriteActions,
    types: onOpenTypeActions,
    views: onOpenViewActions,
  }
  return handlers[sectionId]
}

function primaryItemCanCustomizeColumns(itemId: SidebarItemId) {
  return itemId === 'all-notes' || itemId === 'inbox'
}

function sidebarItemSelection(
  item: MobileSidebarItem,
  label: SidebarDisplayLabel,
  sectionId: SidebarSectionId,
): MobileSidebarItemSelection {
  return {
    count: item.count,
    id: item.id,
    label,
    noteId: item.noteId,
    sectionId,
    typeName: item.typeName,
    viewId: item.viewId,
  }
}

function SidebarItem(props: SidebarItemProps) {
  const themeStyles = useMobileStyles(createThemeStyles), isPhone = isPhoneViewport(useWindowDimensions().width, Platform.OS === 'ios' && Platform.isPad)
  const { mobileColors, styles } = themeStyles
  const {
    active = false,
    activeBackgroundColor = mobileColors.primarySoft,
    activeColor = mobileColors.primary,
    count,
    icon,
    label,
    layoutProbe,
    metricId,
    onLongPress,
    onPress,
    slug,
  } = props

  return (
    <Pressable
      {...probeProps(layoutProbe, `${metricId}.row`)}
      accessibilityLabel={label}
      accessibilityRole="button"
      delayLongPress={300}
      onLongPress={onLongPress}
      onPress={onPress}
      style={[
        styles.item,
        sidebarItemPadding(themeStyles.metrics.sidebar, Boolean(count)),
        phoneViewportStyle(isPhone, themeStyles.phoneItemStyle),
        active ? { backgroundColor: activeBackgroundColor } : null,
      ]}
      testID={`sidebar-item-${slug}`}
    >
      <View
        {...probeProps(layoutProbe, `${metricId}.content`)}
        style={[styles.itemContent, sidebarItemContentHeight(themeStyles.metrics.sidebar, Boolean(count)), phoneViewportStyle(isPhone, themeStyles.phoneItemContentStyle)]}
      >
        {icon}
        <Text
          {...probeProps(layoutProbe, `${metricId}.label`)}
          numberOfLines={1}
          style={[styles.itemText, themeStyles.nativeItemTextStyle, phoneViewportStyle(isPhone, themeStyles.phoneItemTextStyle), active ? { color: activeColor } : null]}
          testID={`sidebar-item-${slug}-label`}
        >
          {label}
        </Text>
        {count && <MobileSidebarCountPill activeColor={active ? activeColor : undefined} layoutProbe={layoutProbe} metricId={`${metricId}.count`} plain={isPhone} testID={`sidebar-item-${slug}-count`} value={count} />}
      </View>
    </Pressable>
  )
}

type SectionTitleProps = {
  expanded: boolean
  count?: string
  createAccessibilityLabel?: string
  label: SidebarDisplayLabel
  layoutProbe?: MobileLayoutProbe
  onCreate?: () => void
  onVisibility?: () => void
  onToggle: () => void
  sectionId: SidebarSectionId
  visibilityAccessibilityLabel?: string
}

function SectionTitle(props: SectionTitleProps) {
  const { count, label, layoutProbe, sectionId } = props
  const themeStyles = useMobileStyles(createThemeStyles)
  const { styles, mobileColors } = themeStyles
  const { fontScale } = useWindowDimensions()
  const metricId = `sidebar.section.${sectionId}`

  return (
    <View
      {...probeProps(layoutProbe, `${metricId}.row`)}
      style={[styles.sectionTitleRow, themeStyles.nativeSectionTitleRowStyle, count ? styles.sectionTitleRowWithCount : styles.sectionTitleRowRegular, fontScale > 1.3 && styles.sectionTitleRowStacked]}
      testID={`sidebar-section-title-${sectionId}`}
    >
      <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ expanded: props.expanded }}
        {...probeProps(layoutProbe, `${metricId}.toggle`)}
        onPress={props.onToggle} style={styles.sectionTitleToggle} testID={`sidebar-section-toggle-${sectionId}`}>
        {props.expanded ? <CaretDown color={mobileColors.textMuted} size={themeStyles.metrics.size(11)} />
          : <CaretRight color={mobileColors.textMuted} size={themeStyles.metrics.size(11)} />}
        <Text
          {...probeProps(layoutProbe, `${metricId}.label`)}
          style={[styles.sectionTitle, themeStyles.nativeSectionTitleTextStyle]}
          testID={`sidebar-section-title-text-${sectionId}`}
        >
          {label}
        </Text>
      </Pressable>
      <SectionTitleActions {...props} />
    </View>
  )
}

function SectionTitleActions(props: SectionTitleProps) {
  const { count, layoutProbe, sectionId } = props
  const themeStyles = useMobileStyles(createThemeStyles)
  const { styles, mobileColors, metrics } = themeStyles
  const { fontScale, width } = useWindowDimensions()
  const isPhone = isPhoneViewport(width, Platform.OS === 'ios' && Platform.isPad)
  const actions = sectionTitleActions(props)
  if (!count && actions.length === 0) return null

  return (
    <View style={[styles.sectionTitleActions, fontScale > 1.3 && styles.sectionTitleActionsStacked]}>
      {count ? (
        <MobileSidebarCountPill
          compact
          layoutProbe={layoutProbe}
          metricId={`sidebar.section.${sectionId}.count`}
          plain={isPhone}
          testID={`sidebar-section-count-${sectionId}`}
          value={count}
        />
      ) : null}
      {actions.map(({ accessibilityLabel, Icon, id, onPress }) => (
        <MobileIconButton
          key={id}
          accessibilityLabel={accessibilityLabel}
          testID={`sidebar-section-${id}-${sectionId}`}
          onPress={onPress}
        >
          <Icon color={mobileColors.textMuted} size={metrics.size(12)} />
        </MobileIconButton>
      ))}
    </View>
  )
}

function sectionTitleActions(props: SectionTitleProps) {
  return [
    { id: 'visibility', Icon: Eye, onPress: props.onVisibility, accessibilityLabel: props.visibilityAccessibilityLabel ?? mobileText('sidebar.section.showInSidebar') },
    { id: 'create', Icon: Plus, onPress: props.onCreate, accessibilityLabel: props.createAccessibilityLabel ?? mobileText('sidebar.action.createView') },
  ].filter((action) => action.onPress)
}

function sidebarIcon(themeStyles: ReturnType<typeof createThemeStyles>, icon: MobileSidebarIcon, tone?: MobileNote['typeTone'] | 'primary') {
  const color = sidebarIconColor(themeStyles, tone)

  const size = themeStyles.metrics.size(15)
  return mobilePhosphorIconElement(icon, { color, size }) ?? <FileText color={color} size={size} />
}

function sidebarIconColor(themeStyles: ReturnType<typeof createThemeStyles>, tone?: MobileNote['typeTone'] | 'primary') {
  const { mobileColors } = themeStyles
  if (tone === 'primary') return mobileColors.primary
  if (tone) return noteTypeColor(tone, mobileColors)

  return mobileColors.textMuted
}

function sidebarActiveColor(themeStyles: ReturnType<typeof createThemeStyles>, tone?: MobileNote['typeTone']) {
  const { mobileColors } = themeStyles
  return tone ? noteTypeColor(tone, mobileColors) : mobileColors.primary
}

function sidebarActiveBackgroundColor(themeStyles: ReturnType<typeof createThemeStyles>, tone?: MobileNote['typeTone']) {
  const { mobileColors } = themeStyles
  return tone ? noteTypeSoftColor(tone, mobileColors) : mobileColors.primarySoft
}

function sidebarLabel(id: SidebarItemId, fallback: SidebarDisplayLabel) {
  if (id === 'all-notes') return mobileCopy.allNotes
  if (id === 'archive') return mobileCopy.archive
  if (id === 'inbox') return mobileCopy.inbox

  return fallback
}

function sidebarSectionLabel(id: SidebarSectionId, fallback: SidebarDisplayLabel) {
  if (id === 'folders') return mobileText('sidebar.group.folders')
  if (id === 'favorites') return mobileCopy.favorites
  if (id === 'types') return mobileCopy.types
  if (id === 'views') return mobileCopy.views

  return fallback
}

function sidebarItemPadding(desktopSidebarParity: MobileMetrics['sidebar'], hasCount: boolean) {
  const padding = hasCount ? desktopSidebarParity.itemPadding.withCount : desktopSidebarParity.itemPadding.regular
  const contentHeight = hasCount ? desktopSidebarParity.itemContentHeight.withCount : desktopSidebarParity.itemContentHeight.regular

  return {
    minHeight: contentHeight + padding.top + padding.bottom,
    paddingBottom: padding.bottom,
    paddingLeft: padding.left,
    paddingRight: padding.right,
    paddingTop: padding.top,
  }
}

function sidebarItemContentHeight(desktopSidebarParity: MobileMetrics['sidebar'], hasCount: boolean) {
  const minHeight = hasCount ? desktopSidebarParity.itemContentHeight.withCount : desktopSidebarParity.itemContentHeight.regular
  return { minHeight }
}
