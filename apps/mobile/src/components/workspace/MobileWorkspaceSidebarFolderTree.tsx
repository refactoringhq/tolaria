import { CaretDown, CaretRight, Folder, FolderOpen } from 'phosphor-react-native'
import { Platform, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native'
import { type MobileLayoutProbe, probeProps } from '../../qa/mobileLayoutProbe'
import { isPhoneViewport, type MobileMetrics, phoneViewportStyle } from '../../ui/mobileMetrics'
import type { MobileColors } from '../../ui/theme/mobilePalette'
import { useMobileStyles } from '../../ui/theme/useMobileTheme'
import type { MobileSidebarFolder } from '../../workspace/mobileWorkspaceModel'
import { Text } from '../ui/text'

export type MobileSidebarFolderSelection = {
  id: string
  name: string
}

export function FolderTree({
  activeFolderId,
  folders,
  layoutProbe,
  onOpenFolderActions,
  onSelectFolder,
}: {
  activeFolderId?: string | null
  folders: MobileSidebarFolder[]
  layoutProbe?: MobileLayoutProbe
  onOpenFolderActions?: (selection: MobileSidebarFolderSelection) => void
  onSelectFolder?: (selection: MobileSidebarFolderSelection) => void
}) {
  const { folderTreeStyles } = useMobileStyles(createThemeStyles)
  return (
    <View {...probeProps(layoutProbe, 'sidebar.folderTree.root')} style={folderTreeStyles.tree}>
      {folders.map((folder) => (
        <FolderTreeRow
          activeFolderId={activeFolderId}
          depth={0}
          folder={folder}
          key={folder.id}
          layoutProbe={layoutProbe}
          onOpenFolderActions={onOpenFolderActions}
          onSelectFolder={onSelectFolder}
        />
      ))}
    </View>
  )
}

function FolderTreeRow({
  activeFolderId,
  depth,
  folder,
  layoutProbe,
  onOpenFolderActions,
  onSelectFolder,
}: {
  activeFolderId?: string | null
  depth: number
  folder: MobileSidebarFolder
  layoutProbe?: MobileLayoutProbe
  onOpenFolderActions?: (selection: MobileSidebarFolderSelection) => void
  onSelectFolder?: (selection: MobileSidebarFolderSelection) => void
}) {
  const { folderTreeStyles, nativeFolderTreeRowStyle, nativeFolderTreeTextStyle, metrics } = useMobileStyles(createThemeStyles)
  const isPhone = isPhoneViewport(useWindowDimensions().width, Platform.OS === 'ios' && Platform.isPad)
  const hasChildren = folder.children.length > 0
  const active = activeFolderId ? folder.id === activeFolderId : folder.active
  const metricId = sidebarFolderMetricId(folder.id)
  const selection = { id: folder.id, name: folder.name }

  return (
    <View {...probeProps(layoutProbe, `${metricId}.container`)}>
      <Pressable
        {...probeProps(layoutProbe, `${metricId}.row`)}
        accessibilityLabel={folder.name}
        accessibilityRole="button"
        onLongPress={() => onOpenFolderActions?.(selection)}
        onPress={() => onSelectFolder?.(selection)}
        style={[
          folderTreeStyles.row,
          nativeFolderTreeRowStyle,
          phoneViewportStyle(isPhone, folderTreeStyles.phoneRow),
          active ? folderTreeStyles.rowActive : null,
          folderTreeIndent(metrics.sidebar, depth),
        ]}
      >
        <View {...probeProps(layoutProbe, `${metricId}.content`)} style={folderTreeStyles.rowContent}>
          <FolderTreeCaret expanded={folder.expanded} hasChildren={hasChildren} />
          <FolderTreeIcon active={active} expanded={folder.expanded} />
          <Text
            {...probeProps(layoutProbe, `${metricId}.label`)}
            numberOfLines={1}
            style={[folderTreeStyles.rowText, nativeFolderTreeTextStyle, phoneViewportStyle(isPhone, folderTreeStyles.phoneRowText), active ? folderTreeStyles.rowTextActive : null]}
          >
            {folder.name}
          </Text>
        </View>
      </Pressable>
      {folder.expanded && hasChildren ? (
        <View style={folderTreeStyles.children}>
          {folder.children.map((child) => (
            <FolderTreeRow
              activeFolderId={activeFolderId}
              depth={depth + 1}
              folder={child}
              key={child.id}
              layoutProbe={layoutProbe}
              onOpenFolderActions={onOpenFolderActions}
              onSelectFolder={onSelectFolder}
            />
          ))}
        </View>
      ) : null}
    </View>
  )
}

function sidebarFolderMetricId(folderId: string) {
  const segment = folderId
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

  return `sidebar.folder.${segment || 'folder'}`
}

function createFolderLayoutStyles(metrics: MobileMetrics) {
  const desktopSidebarParity = metrics.sidebar
  return StyleSheet.create({
  caretSpacer: {
    width: metrics.size(11),
  },
  children: {
    position: 'relative',
  },
  tree: {
    gap: metrics.size(2),
    paddingBottom: desktopSidebarParity.sectionContentPaddingBottom,
  },
  row: {
    justifyContent: 'center',
    borderRadius: desktopSidebarParity.itemRadius,
    minHeight: desktopSidebarParity.folderRowHeight,
    paddingBottom: desktopSidebarParity.itemPadding.regular.bottom,
    paddingRight: desktopSidebarParity.itemPadding.regular.right,
    paddingTop: desktopSidebarParity.itemPadding.regular.top,
    width: '100%',
  },
  rowContent: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: desktopSidebarParity.folderIconGap,
  },
  })
}

function folderTreeIndent(desktopSidebarParity: MobileMetrics['sidebar'], depth: number) {
  return {
    paddingLeft: desktopSidebarParity.folderRowContentInset
      + depth * desktopSidebarParity.folderRowIndent,
  }
}

function FolderTreeCaret({
  expanded,
  hasChildren,
}: {
  expanded?: boolean
  hasChildren: boolean
}) {
  const { folderTreeStyles, mobileColors, metrics } = useMobileStyles(createThemeStyles)
  if (!hasChildren) {
    return <View style={folderTreeStyles.caretSpacer} />
  }

  return expanded ? <CaretDown color={mobileColors.textMuted} size={metrics.size(11)} /> : <CaretRight color={mobileColors.textMuted} size={metrics.size(11)} />
}

function FolderTreeIcon({
  active,
  expanded,
}: {
  active?: boolean
  expanded?: boolean
}) {
  const { mobileColors, metrics } = useMobileStyles(createThemeStyles)
  const isPhone = isPhoneViewport(useWindowDimensions().width, Platform.OS === 'ios' && Platform.isPad)
  const iconColor = active ? mobileColors.primary : mobileColors.textMuted
  const iconSize = phoneFolderTreeIconSize(isPhone, metrics)

  if (active || expanded) {
    return <FolderOpen color={iconColor} size={iconSize} weight={active ? 'fill' : 'regular'} />
  }

  return <Folder color={iconColor} size={iconSize} />
}

function phoneFolderTreeIconSize(isPhone: boolean, metrics: MobileMetrics) {
  return phoneViewportStyle(isPhone, metrics.phoneChrome.folderIconSize) ?? metrics.size(16)
}

function createThemeStyles(mobileColors: MobileColors, metrics: MobileMetrics) {
  const { sidebar: desktopSidebarParity } = metrics
  const nativeFolderTreeStyles = StyleSheet.create({
    row: { minHeight: metrics.size(30) },
    text: { lineHeight: metrics.size(18) },
  })
  const folderTreeStateStyles = StyleSheet.create({
    rowActive: {
      backgroundColor: mobileColors.primarySoft,
    },
  })

  const folderTreeTextStyles = StyleSheet.create({
    phoneRow: { minHeight: metrics.phoneChrome.folderRowHeight, paddingVertical: 0 },
    phoneRowText: {
      fontSize: metrics.phoneChrome.folderTextSize,
      lineHeight: metrics.phoneChrome.folderTextLineHeight,
    },
    rowText: {
      flex: 1,
      color: mobileColors.text,
      fontSize: desktopSidebarParity.itemTextSize,
      fontWeight: '500',
    },
    rowTextActive: { color: mobileColors.primary, fontWeight: '600' },
  })

  const folderTreeStyles = {
    ...createFolderLayoutStyles(metrics),
    ...folderTreeStateStyles,
    ...folderTreeTextStyles,
  } as const
  return {
    mobileColors, metrics, folderTreeStateStyles, folderTreeTextStyles, folderTreeStyles,
    nativeFolderTreeRowStyle: Platform.OS === 'web' ? null : nativeFolderTreeStyles.row,
    nativeFolderTreeTextStyle: Platform.OS === 'web' ? null : nativeFolderTreeStyles.text,
  }
}
