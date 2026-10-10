import { describe, expect, it } from 'vitest'
import { desktopNoteItemParity, desktopPanelParity, desktopPropertyParity, desktopRelationshipParity, desktopSidebarParity } from '../ui/desktopParity'
import { mobileSpace } from '../ui/tokens'
import {
  assertNativeMobileLayoutMetrics,
  assertNativePhoneLayoutMetrics,
  assertNativeWysiwygEditorLayoutMetrics,
  formatNativeLayoutAssertionFailures,
  latestNativeLayoutMetrics,
  type NativeLayoutMetric,
  nativeNoteListMetricContract,
  nativePhoneShellMetricContract,
  nativePropertiesMetricContract,
  nativeSidebarMetricContract,
  nativeWysiwygEditorMetricContract,
  parseNativeLayoutMetrics,
} from './nativeLayoutMetrics'

describe('native layout metrics', () => {
  it('keeps the native metric contract synced with desktop sidebar parity tokens', () => {
    expect(nativeSidebarMetricContract).toEqual({
      countPill: {
        compactHeight: desktopSidebarParity.countPillCompactHeight,
        height: desktopSidebarParity.countPillHeight,
      },
      folderSectionContentPaddingBottom: desktopSidebarParity.sectionContentPaddingBottom,
      folderRowContentHeight: desktopSidebarParity.folderRowContentHeight,
      folderRowContentInset: desktopSidebarParity.folderRowContentInset,
      folderRowHeight: desktopSidebarParity.folderRowHeight,
      folderRowIndent: desktopSidebarParity.folderRowIndent,
      itemContentHeight: desktopSidebarParity.itemContentHeight,
      itemLabelLineHeight: desktopSidebarParity.itemLabelLineHeight,
      itemPadding: desktopSidebarParity.itemPadding,
      primarySectionItemCount: 3,
      sectionHorizontalPadding: desktopSidebarParity.sectionHorizontalPadding,
      sectionTitleMinHeight: 30,
      sectionTitleLineHeight: desktopSidebarParity.sectionTitleLineHeight,
      topNavPadding: desktopSidebarParity.topNavPadding,
    })
    expect(nativeNoteListMetricContract).toEqual({
      contentGap: desktopNoteItemParity.contentGap,
      frameX: 0,
      panelWidth: desktopPanelParity.noteListWidth,
      padding: desktopNoteItemParity.padding,
      titleLineHeight: desktopNoteItemParity.titleLineHeight,
    })
  })

  it('keeps native editor and inspector contracts synced with desktop parity tokens', () => {
    expect(nativeWysiwygEditorMetricContract).toEqual({
      minFormHeight: 320,
      toolbarActionCount: 8,
      toolbarActionGap: mobileSpace.xs,
      toolbarActionSize: 44,
      toolbarHostPaddingHorizontal: mobileSpace.md,
      toolbarHostPaddingTop: mobileSpace.xs,
    })
    expect(nativePropertiesMetricContract).toEqual({
      labelWidth: 86,
      panelPadding: desktopPropertyParity.panelPadding,
      panelWidth: desktopPanelParity.inspectorWidth,
      relationshipRowMinHeight: desktopPropertyParity.rowMinHeight,
      rowMaxHeight: 96,
      rowMinHeight: desktopPropertyParity.rowMinHeight,
      rowPaddingHorizontal: desktopPropertyParity.rowPaddingHorizontal,
    })
    expect(nativePhoneShellMetricContract).toEqual({
      drawerMaxWidth: 320,
      drawerWidthRatio: 0.78,
      maxWidth: 899,
      minContentHeight: 320,
      minRootHeight: 480,
    })
  })

  it('parses simulator log metrics and keeps the latest metric per id', () => {
    const metrics = latestNativeLayoutMetrics(
      parseNativeLayoutMetrics(
        ['noise before metric', 'TOLARIA_MOBILE_LAYOUT_METRIC {"height":12,"id":"sidebar.item.inbox.row","platform":"ios","width":10,"x":1,"y":2}', 'TOLARIA_MOBILE_LAYOUT_METRIC {"height":32,"id":"sidebar.item.inbox.row","platform":"ios","width":247.5,"x":6,"y":4}', 'TOLARIA_MOBILE_LAYOUT_METRIC not-json'].join('\n'),
      ),
    )

    expect(metrics['sidebar.item.inbox.row']).toEqual({
      height: 32,
      id: 'sidebar.item.inbox.row',
      platform: 'ios',
      width: 247.5,
      x: 6,
      y: 4,
    })
  })

  it('accepts native phone list metrics that keep desktop note row spacing at full width', () => {
    const metrics = nativePhoneListMetrics({
      firstId: 'noteList.item.workflow-orchestration',
      secondId: 'noteList.item.open-source-project',
      width: 390,
    })

    expect(assertNativePhoneLayoutMetrics(metrics, 'list')).toEqual([])
  })

  it('accepts native phone list metrics from real-vault note ids', () => {
    const metrics = nativePhoneListMetrics({
      firstId: 'noteList.item.tolaria-release-v2026-06-23.md',
      secondId: 'noteList.item.refactoring-newsletter-36-month-business-plan.md',
      width: 402,
    })

    expect(assertNativePhoneLayoutMetrics(metrics, 'list')).toEqual([])
  })

  it('reports native phone sidebar metrics that miss drawer or shared sidebar spacing evidence', () => {
    const phoneWidth = 390
    const metrics = latestNativeLayoutMetrics(
      [
        phoneRootMetric({ width: phoneWidth }),
        phoneScreenMetric('sidebar', { width: phoneWidth }),
        phoneSidebarDrawerMetric({ drawerWidth: 240, width: phoneWidth }),
        noteListPanelMetric({ width: phoneWidth }),
        noteListItemMetric('noteList.item.workflow-orchestration', {
          frameWidth: phoneWidth,
          selected: true,
          y: 0,
        }),
        noteListItemMetric('noteList.item.open-source-project', {
          frameWidth: phoneWidth,
          y: 118,
        }),
      ].flat(),
    )

    const formatted = formatNativeLayoutAssertionFailures(assertNativePhoneLayoutMetrics(metrics, 'sidebar'))

    expect(formatted).toContain('phone.sidebar.drawer: phone sidebar drawer keeps the compact navigation width')
    expect(formatted).toContain('sidebar.item.inbox: row is captured before checking native padding')
  })

  it('accepts native phone properties metrics that keep desktop inspector density', () => {
    const phoneWidth = 390
    const metrics = latestNativeLayoutMetrics(
      [
        phoneRootMetric({ width: phoneWidth }),
        phoneScreenMetric('properties', { width: phoneWidth }),
        propertiesPanelMetric({ width: phoneWidth }),
        propertyRowMetric('properties.row.type', { panelWidth: phoneWidth }),
        propertyRowMetric('properties.row.created', { panelWidth: phoneWidth }),
        propertyRowMetric('properties.row.modified', {
          panelWidth: phoneWidth,
        }),
        propertyRowMetric('properties.row.workspace', {
          panelWidth: phoneWidth,
        }),
        propertyRowMetric('properties.row.links', { panelWidth: phoneWidth }),
        propertySectionMetric('properties.section.tags', {
          panelWidth: phoneWidth,
        }),
        propertySectionMetric('properties.section.belongs-to', {
          panelWidth: phoneWidth,
        }),
        propertyActionMetric('properties.action.add-property', {
          panelWidth: phoneWidth,
        }),
        propertyActionMetric('properties.action.add-relationship', {
          panelWidth: phoneWidth,
        }),
        relationshipRowMetric('properties.relationship.llm-workflow', 'properties.section.belongs-to', {
          panelWidth: phoneWidth,
        }),
      ].flat(),
    )

    expect(assertNativePhoneLayoutMetrics(metrics, 'properties')).toEqual([])
  })

  it('reports native phone properties metrics that lose desktop row padding', () => {
    const phoneWidth = 390
    const metrics = latestNativeLayoutMetrics(
      [
        phoneRootMetric({ width: phoneWidth }),
        phoneScreenMetric('properties', { width: phoneWidth }),
        propertiesPanelMetric({ width: phoneWidth }),
        propertyRowMetric('properties.row.type', {
          labelX: 0,
          panelWidth: phoneWidth,
          rowHeight: 20,
          rowX: 0,
          valueRightPadding: 0,
        }),
        propertyRowMetric('properties.row.created', { panelWidth: phoneWidth }),
        propertyRowMetric('properties.row.modified', {
          panelWidth: phoneWidth,
        }),
        propertyRowMetric('properties.row.workspace', {
          panelWidth: phoneWidth,
        }),
        propertyRowMetric('properties.row.links', { panelWidth: phoneWidth }),
        propertySectionMetric('properties.section.tags', {
          panelWidth: phoneWidth,
        }),
        propertySectionMetric('properties.section.belongs-to', {
          panelWidth: phoneWidth,
        }),
        propertyActionMetric('properties.action.add-property', {
          panelWidth: phoneWidth,
          rowX: 0,
          valueRightPadding: 0,
        }),
        propertyActionMetric('properties.action.add-relationship', {
          panelWidth: phoneWidth,
        }),
        relationshipRowMetric('properties.relationship.llm-workflow', 'properties.section.belongs-to', {
          panelWidth: phoneWidth,
          rowWidth: 260,
        }),
      ].flat(),
    )

    const formatted = formatNativeLayoutAssertionFailures(assertNativePhoneLayoutMetrics(metrics, 'properties'))

    expect(formatted).toContain('properties.row.type: property row keeps desktop panel inset')
    expect(formatted).toContain('properties.row.type: property row keeps desktop minimum height')
    expect(formatted).toContain('properties.row.type: property label keeps desktop row inset')
    expect(formatted).toContain('properties.row.type: property value keeps desktop right padding')
    expect(formatted).toContain('properties.action.add-property: property action row keeps desktop panel inset')
    expect(formatted).toContain('properties.action.add-property: property action value keeps desktop right padding')
    expect(formatted).toContain('properties.relationship.llm-workflow: relationship row fills the property value width')
  })

  it('accepts native sidebar metrics that match desktop spacing tokens', () => {
    const metrics = latestNativeLayoutMetrics(validNativeDesktopMetrics.flat())

    expect(assertNativeMobileLayoutMetrics(metrics)).toEqual([])
  })

  it('reports native sidebar rows that lose horizontal or vertical padding', () => {
    const metrics = latestNativeLayoutMetrics(invalidNativeDesktopSpacingMetrics.flat())

    const failures = assertNativeMobileLayoutMetrics(metrics)
    const formatted = formatNativeLayoutAssertionFailures(failures)

    expect(formatted).toContain('sidebar.item.inbox: row keeps desktop section inset')
    expect(formatted).toContain('sidebar.item.inbox: row keeps desktop vertical padding')
    expect(formatted).toContain('sidebar.folder.writing: folder content keeps desktop indentation')
    expect(formatted).toContain('sidebar.section.favorites: section title keeps desktop header height')
    expect(formatted).toContain('sidebar.item.personal-journal.row: first row starts exactly after the sidebar section title')
    expect(formatted).toContain('sidebar.item.all-notes: row starts exactly after the previous sidebar row')
    expect(formatted).toContain('sidebar.item.essays.count: count text is vertically centered inside native pill')
    expect(formatted).toContain('sidebar.section.primary: primary section keeps desktop top padding')
    expect(formatted).toContain('sidebar.folderTree.root: folder tree keeps desktop section inset')
    expect(formatted).toContain('sidebar.folder.writing-drafts: metric starts after the previous metric')
    expect(formatted).toContain('noteList.panel: note list keeps desktop column width')
    expect(formatted).toContain('noteList.item.workflow-orchestration.frame: note row surface fills the desktop note-list column')
    expect(formatted).toContain('noteList.item.workflow-orchestration.header: note row content keeps desktop horizontal padding')
    expect(formatted).toContain('noteList.item.workflow-orchestration.header: note row content keeps desktop top padding')
    expect(formatted).toContain('noteList.item.workflow-orchestration.title: note row title keeps desktop line height')
  })

  it('accepts native WYSIWYG editor metrics that match desktop toolbar tokens', () => {
    const metrics = latestNativeLayoutMetrics(wysiwygEditorMetric())

    expect(assertNativeWysiwygEditorLayoutMetrics(metrics)).toEqual([])
  })

  it('reports native WYSIWYG editor metrics that lose toolbar spacing', () => {
    const metrics = latestNativeLayoutMetrics(
      wysiwygEditorMetric({
        actionGap: 0,
        actionSize: 20,
        toolbarHostBottomGap: 18,
        toolbarX: 0,
      }),
    )

    const formatted = formatNativeLayoutAssertionFailures(assertNativeWysiwygEditorLayoutMetrics(metrics))

    expect(formatted).toContain('editor.wysiwyg.toolbarHost: WYSIWYG toolbar stays pinned to the editor bottom')
    expect(formatted).toContain('editor.wysiwyg.toolbar: WYSIWYG toolbar keeps desktop horizontal inset')
    expect(formatted).toContain('editor.wysiwyg.toolbar.action.bold: WYSIWYG toolbar action keeps tablet touch target width')
    expect(formatted).toContain('editor.wysiwyg.toolbar.action.italic: WYSIWYG toolbar action keeps desktop action gap')
  })
})

const validNativeDesktopMetrics = [
  containerMetric({ height: 104, id: 'sidebar.section.primary.container', width: 259.5 }),
  itemMetric('sidebar.item.inbox', { hasCount: true, y: 4 }),
  itemMetric('sidebar.item.all-notes', { hasCount: true, y: 36 }),
  itemMetric('sidebar.item.archive', { hasCount: true, y: 68 }),
  containerMetric({ height: 90, id: 'sidebar.section.favorites.container', width: 259.5, y: 104 }),
  sectionMetric('favorites'),
  itemMetric('sidebar.item.personal-journal', { hasCount: false, y: 30 }),
  itemMetric('sidebar.item.tolaria-mvp', { hasCount: false, y: 60 }),
  containerMetric({ height: 72, id: 'sidebar.section.views.container', width: 259.5, y: 194 }),
  sectionMetric('views', 40),
  itemMetric('sidebar.item.view-active-procedures', { hasCount: true, y: 40 }),
  containerMetric({ height: 130, id: 'sidebar.section.types.container', width: 259.5, y: 266 }),
  sectionMetric('types'),
  itemMetric('sidebar.item.essays', { hasCount: true, y: 30 }),
  itemMetric('sidebar.item.procedures', { hasCount: true, y: 62 }),
  itemMetric('sidebar.item.responsibilities', { hasCount: true, y: 94 }),
  containerMetric({ height: 220, id: 'sidebar.section.folders.container', width: 259.5, y: 396 }),
  sectionMetric('folders'),
  countPillMetric('sidebar.item.archive.count'),
  countPillMetric('sidebar.item.view-active-procedures.count'),
  countPillMetric('sidebar.section.types.count', { compact: true }),
  folderTreeRootMetric(30, { height: 190, x: 6 }),
  containerMetric({ height: 90, id: 'sidebar.folder.writing.container' }),
  folderMetric('sidebar.folder.writing', 12),
  containerMetric({ height: 30, id: 'sidebar.folder.writing-essays.container' }),
  folderMetric('sidebar.folder.writing-essays', 37),
  containerMetric({ height: 30, id: 'sidebar.folder.writing-drafts.container', y: 30 }),
  folderMetric('sidebar.folder.writing-drafts', 37),
  containerMetric({ height: 90, id: 'sidebar.folder.tolaria.container', y: 90 }),
  folderMetric('sidebar.folder.tolaria', 12),
  containerMetric({ height: 30, id: 'sidebar.folder.tolaria-mobile-ui.container' }),
  folderMetric('sidebar.folder.tolaria-mobile-ui', 37),
  containerMetric({ height: 30, id: 'sidebar.folder.tolaria-releases.container', y: 30 }),
  folderMetric('sidebar.folder.tolaria-releases', 37),
  noteListPanelMetric(),
  noteListItemMetric('noteList.item.workflow-orchestration', { selected: true, y: 0 }),
  noteListItemMetric('noteList.item.open-source-project', { y: 118 }),
  propertiesPanelMetric(),
  propertyRowMetric('properties.row.type'),
  propertyRowMetric('properties.row.created'),
  propertyRowMetric('properties.row.modified'),
  propertyRowMetric('properties.row.workspace'),
  propertyRowMetric('properties.row.links'),
  propertySectionMetric('properties.section.tags'),
  propertySectionMetric('properties.section.belongs-to'),
  propertyActionMetric('properties.action.add-property'),
  propertyActionMetric('properties.action.add-relationship'),
  relationshipRowMetric('properties.relationship.llm-workflow', 'properties.section.belongs-to'),
]

const invalidNativeDesktopSpacingMetrics = [
  containerMetric({ height: 94, id: 'sidebar.section.primary.container', width: 259.5 }),
  itemMetric('sidebar.item.inbox', { hasCount: true, rowHeight: 22, rowX: 0 }),
  itemMetric('sidebar.item.all-notes', { hasCount: true, y: 10 }),
  itemMetric('sidebar.item.archive', { hasCount: true, y: 64 }),
  containerMetric({ height: 76, id: 'sidebar.section.favorites.container', width: 259.5, y: 80 }),
  sectionMetric('favorites', 18),
  itemMetric('sidebar.item.personal-journal', { hasCount: false, y: 16 }),
  itemMetric('sidebar.item.tolaria-mvp', { hasCount: false, y: 46 }),
  containerMetric({ height: 72, id: 'sidebar.section.views.container', width: 259.5, y: 156 }),
  sectionMetric('views', 40),
  itemMetric('sidebar.item.view-active-procedures', { hasCount: true, y: 40 }),
  containerMetric({ height: 130, id: 'sidebar.section.types.container', width: 259.5, y: 220 }),
  sectionMetric('types'),
  itemMetric('sidebar.item.essays', { hasCount: true, y: 30 }),
  itemMetric('sidebar.item.procedures', { hasCount: true, y: 62 }),
  itemMetric('sidebar.item.responsibilities', { hasCount: true, y: 94 }),
  countPillMetric('sidebar.item.essays.count', { textY: 0 }),
  countPillMetric('sidebar.item.archive.count'),
  countPillMetric('sidebar.item.view-active-procedures.count'),
  containerMetric({ height: 180, id: 'sidebar.section.folders.container', width: 259.5, y: 350 }),
  sectionMetric('folders'),
  countPillMetric('sidebar.section.types.count', { compact: true }),
  folderTreeRootMetric(30, { height: 120, x: 0 }),
  containerMetric({ height: 70, id: 'sidebar.folder.writing.container' }),
  folderMetric('sidebar.folder.writing', 0),
  containerMetric({ height: 30, id: 'sidebar.folder.writing-essays.container' }),
  folderMetric('sidebar.folder.writing-essays', 37),
  containerMetric({ height: 30, id: 'sidebar.folder.writing-drafts.container' }),
  folderMetric('sidebar.folder.writing-drafts', 37),
  containerMetric({ height: 40, id: 'sidebar.folder.tolaria.container', y: 40 }),
  folderMetric('sidebar.folder.tolaria', 12),
  containerMetric({ height: 30, id: 'sidebar.folder.tolaria-mobile-ui.container' }),
  folderMetric('sidebar.folder.tolaria-mobile-ui', 37),
  containerMetric({ height: 30, id: 'sidebar.folder.tolaria-releases.container' }),
  folderMetric('sidebar.folder.tolaria-releases', 37),
  noteListPanelMetric({ width: 284 }),
  noteListItemMetric('noteList.item.workflow-orchestration', {
    frameWidth: 284,
    headerX: 0,
    headerY: 2,
    selected: true,
    titleHeight: 14,
  }),
  noteListItemMetric('noteList.item.open-source-project', { frameWidth: 284, headerX: 0, y: 22 }),
]

const wysiwygToolbarActions = ['action.bold', 'action.italic', 'action.link', 'action.wikilink', 'group.headings', 'group.lists', 'group.insert', 'group.more'] as const

function wysiwygEditorMetric({
  actionGap = nativeWysiwygEditorMetricContract.toolbarActionGap,
  actionSize = nativeWysiwygEditorMetricContract.toolbarActionSize,
  formHeight = 640,
  formWidth = 760,
  toolbarHostBottomGap = 0,
  toolbarX = nativeWysiwygEditorMetricContract.toolbarHostPaddingHorizontal,
  toolbarY = nativeWysiwygEditorMetricContract.toolbarHostPaddingTop,
}: {
  actionGap?: number
  actionSize?: number
  formHeight?: number
  formWidth?: number
  toolbarHostBottomGap?: number
  toolbarX?: number
  toolbarY?: number
} = {}): NativeLayoutMetric[] {
  const toolbarHostHeight = toolbarY + actionSize + mobileSpace.xs

  return [
    containerMetric({
      height: formHeight,
      id: 'editor.wysiwyg.form',
      width: formWidth,
    }),
    containerMetric({
      height: formHeight,
      id: 'editor.wysiwyg.richText',
      width: formWidth,
    }),
    containerMetric({
      height: toolbarHostHeight,
      id: 'editor.wysiwyg.toolbarHost',
      width: formWidth,
      y: formHeight - toolbarHostHeight - toolbarHostBottomGap,
    }),
    containerMetric({
      height: actionSize,
      id: 'editor.wysiwyg.toolbar',
      width: wysiwygToolbarWidth(actionSize, actionGap),
      x: toolbarX,
      y: toolbarY,
    }),
    ...wysiwygToolbarActions.map((action, index) =>
      containerMetric({
        height: actionSize,
        id: `editor.wysiwyg.toolbar.${action}`,
        width: actionSize,
        x: index * (actionSize + actionGap),
      }),
    ),
  ]
}

function wysiwygToolbarWidth(actionSize: number, actionGap: number) {
  return wysiwygToolbarActions.length * actionSize + (wysiwygToolbarActions.length - 1) * actionGap
}

function propertiesPanelMetric({ width = desktopPanelParity.inspectorWidth }: { width?: number } = {}): NativeLayoutMetric {
  return containerMetric({ height: 704, id: 'properties.panel', width })
}

function propertyRowMetric(
  id: string,
  {
    labelX = desktopPropertyParity.rowPaddingHorizontal,
    labelWidth = nativePropertiesMetricContract.labelWidth,
    panelWidth = desktopPanelParity.inspectorWidth,
    rowHeight = desktopPropertyParity.rowMinHeight,
    rowX = desktopPropertyParity.panelPadding,
    valueRightPadding = desktopPropertyParity.rowPaddingHorizontal,
  }: {
    labelX?: number
    labelWidth?: number
    panelWidth?: number
    rowHeight?: number
    rowX?: number
    valueRightPadding?: number
  } = {},
): NativeLayoutMetric[] {
  const rowWidth = panelWidth - desktopPropertyParity.panelPadding * 2
  const valueX = labelX + labelWidth + mobileSpace.sm
  const valueWidth = rowWidth - valueX - valueRightPadding

  return [
    containerMetric({
      height: rowHeight,
      id: `${id}.row`,
      width: rowWidth,
      x: rowX,
    }),
    containerMetric({
      height: 18,
      id: `${id}.label`,
      width: labelWidth,
      x: labelX,
      y: 5,
    }),
    containerMetric({
      height: 18,
      id: `${id}.value`,
      width: valueWidth,
      x: valueX,
      y: 5,
    }),
  ]
}

function propertySectionMetric(
  id: string,
  {
    labelX = desktopPropertyParity.rowPaddingHorizontal,
    panelWidth = desktopPanelParity.inspectorWidth,
    rowHeight = 54,
    rowX = desktopPropertyParity.panelPadding,
  }: {
    labelX?: number
    panelWidth?: number
    rowHeight?: number
    rowX?: number
  } = {},
): NativeLayoutMetric[] {
  const rowWidth = panelWidth - desktopPropertyParity.panelPadding * 2

  return [
    containerMetric({
      height: rowHeight,
      id: `${id}.row`,
      width: rowWidth,
      x: rowX,
    }),
    containerMetric({
      height: 18,
      id: `${id}.label`,
      width: nativePropertiesMetricContract.labelWidth,
      x: labelX,
      y: 6,
    }),
    containerMetric({
      height: 28,
      id: `${id}.value`,
      width: rowWidth - labelX * 2,
      x: labelX,
      y: 24,
    }),
  ]
}

function propertyActionMetric(
  id: string,
  {
    labelX = desktopPropertyParity.rowPaddingHorizontal,
    panelWidth = desktopPanelParity.inspectorWidth,
    rowHeight = desktopPropertyParity.rowMinHeight,
    rowX = desktopPropertyParity.panelPadding,
    valueRightPadding = desktopPropertyParity.rowPaddingHorizontal,
  }: {
    labelX?: number
    panelWidth?: number
    rowHeight?: number
    rowX?: number
    valueRightPadding?: number
  } = {},
): NativeLayoutMetric[] {
  const rowWidth = panelWidth - desktopPropertyParity.panelPadding * 2
  const contentWidth = rowWidth - desktopPropertyParity.rowPaddingHorizontal - valueRightPadding - mobileSpace.sm
  const labelWidth = contentWidth / 2
  const valueWidth = contentWidth - labelWidth
  const valueX = labelX + labelWidth + mobileSpace.sm

  return [
    containerMetric({
      height: rowHeight,
      id: `${id}.row`,
      width: rowWidth,
      x: rowX,
    }),
    containerMetric({
      height: 18,
      id: `${id}.label`,
      width: labelWidth,
      x: labelX,
      y: 5,
    }),
    containerMetric({
      height: 18,
      id: `${id}.value`,
      width: valueWidth,
      x: valueX,
      y: 5,
    }),
  ]
}

function relationshipRowMetric(
  id: string,
  sectionId: string,
  {
    panelWidth = desktopPanelParity.inspectorWidth,
    rowWidth,
  }: {
    panelWidth?: number
    rowWidth?: number
  } = {},
): NativeLayoutMetric[] {
  const sectionValueWidth = panelWidth - desktopPropertyParity.panelPadding * 2 - desktopPropertyParity.rowPaddingHorizontal * 2
  const actualRowWidth = rowWidth ?? sectionValueWidth

  return [
    containerMetric({
      height: desktopPropertyParity.rowMinHeight,
      id: `${id}.row`,
      width: actualRowWidth,
    }),
    containerMetric({
      height: 18,
      id: `${id}.target`,
      width: actualRowWidth - desktopRelationshipParity.removeIconSize - desktopRelationshipParity.rowGap,
      x: desktopRelationshipParity.rowPaddingHorizontal,
      y: desktopRelationshipParity.rowPaddingVertical,
    }),
    containerMetric({
      height: 18,
      id: `${id}.text`,
      width: 160,
      x: desktopRelationshipParity.iconSize + desktopRelationshipParity.rowGap,
      y: 0,
    }),
    containerMetric({
      height: 28,
      id: `${sectionId}.value`,
      width: sectionValueWidth,
      x: desktopPropertyParity.rowPaddingHorizontal,
      y: 24,
    }),
  ]
}

function itemMetric(
  id: string,
  {
    hasCount,
    rowHeight = hasCount ? 32 : 30,
    rowX = 6,
    y = 0,
  }: {
    hasCount: boolean
    rowHeight?: number
    rowX?: number
    y?: number
  },
): NativeLayoutMetric[] {
  const contentHeight = hasCount ? 20 : 18
  const contentWidth = hasCount ? 227.5 : 219.5
  const rowWidth = 247.5

  return [
    {
      height: rowHeight,
      id: `${id}.row`,
      platform: 'ios',
      width: rowWidth,
      x: rowX,
      y,
    },
    {
      height: contentHeight,
      id: `${id}.content`,
      platform: 'ios',
      width: contentWidth,
      x: 12,
      y: hasCount ? 6 : 7,
    },
    {
      height: desktopSidebarParity.itemLabelLineHeight,
      id: `${id}.label`,
      platform: 'ios',
      width: hasCount ? 174.5 : 196.5,
      x: 23,
      y: hasCount ? 1 : 0,
    },
    ...(hasCount ? countPillMetric(`${id}.count`) : []),
  ]
}

function countPillMetric(
  id: string,
  {
    compact = false,
    textY = compact ? 2 : 3,
  }: {
    compact?: boolean
    textY?: number
  } = {},
): NativeLayoutMetric[] {
  const height = compact ? desktopSidebarParity.countPillCompactHeight : desktopSidebarParity.countPillHeight

  return [
    {
      height,
      id: `${id}.container`,
      platform: 'ios',
      width: 22,
      x: 202,
      y: 0,
    },
    {
      height: 14,
      id: `${id}.text`,
      platform: 'ios',
      width: 18,
      x: 2,
      y: textY,
    },
  ]
}

function nativePhoneListMetrics({ firstId, secondId, width }: { firstId: string; secondId: string; width: number }) {
  return latestNativeLayoutMetrics([phoneRootMetric({ width }), phoneScreenMetric('list', { width }), noteListPanelMetric({ width }), noteListItemMetric(firstId, { frameWidth: width, selected: true }), noteListItemMetric(secondId, { frameWidth: width })].flat())
}

function noteListPanelMetric({ width = desktopPanelParity.noteListWidth }: { width?: number } = {}): NativeLayoutMetric {
  return {
    height: 768,
    id: 'noteList.panel',
    platform: 'ios',
    width,
    x: 0,
    y: 0,
  }
}

function phoneRootMetric({ height = 760, width = 390 }: { height?: number; width?: number } = {}): NativeLayoutMetric {
  return containerMetric({ height, id: 'phone.root', width })
}

function phoneScreenMetric(
  state: 'editor' | 'list' | 'properties' | 'sidebar',
  {
    height = 704,
    width = 390,
  }: {
    height?: number
    width?: number
  } = {},
): NativeLayoutMetric {
  return containerMetric({ height, id: `phone.${state}.screen`, width })
}

function phoneSidebarDrawerMetric({ drawerWidth, width }: { drawerWidth?: number; width: number }): NativeLayoutMetric[] {
  const actualDrawerWidth = drawerWidth ?? Math.round(width * nativePhoneShellMetricContract.drawerWidthRatio)

  return [
    containerMetric({
      height: 704,
      id: 'phone.sidebar.drawer',
      width: actualDrawerWidth,
    }),
    containerMetric({
      height: 704,
      id: 'phone.sidebar.preview',
      width,
      x: actualDrawerWidth,
    }),
  ]
}

function noteListItemMetric(
  id: string,
  {
    bodyX,
    frameWidth = desktopPanelParity.noteListWidth,
    headerX,
    headerY = desktopNoteItemParity.padding.top,
    selected = false,
    titleHeight = desktopNoteItemParity.titleLineHeight,
    y = 0,
  }: {
    bodyX?: number
    frameWidth?: number
    headerX?: number
    headerY?: number
    selected?: boolean
    titleHeight?: number
    y?: number
  } = {},
): NativeLayoutMetric[] {
  const bodyOffsetX = bodyX ?? (selected ? desktopNoteItemParity.borderLeftWidth : 0)
  const headerOffsetX = headerX ?? (selected ? desktopNoteItemParity.selectedPaddingLeft : desktopNoteItemParity.padding.left)
  const bodyWidth = frameWidth - bodyOffsetX
  const headerWidth = bodyWidth - headerOffsetX - desktopNoteItemParity.padding.right
  const subtitleHeight = desktopNoteItemParity.snippetLineHeight * 2
  const subtitleY = headerY + desktopNoteItemParity.titleLineHeight + desktopNoteItemParity.contentGap
  const footerY = subtitleY + subtitleHeight + desktopNoteItemParity.contentGap
  const rowHeight = footerY + 20 + desktopNoteItemParity.padding.bottom

  return [
    {
      height: rowHeight,
      id: `${id}.frame`,
      platform: 'ios',
      width: frameWidth,
      x: 0,
      y,
    },
    {
      height: rowHeight,
      id: `${id}.body`,
      platform: 'ios',
      width: bodyWidth,
      x: bodyOffsetX,
      y: 0,
    },
    {
      height: desktopNoteItemParity.titleLineHeight,
      id: `${id}.header`,
      platform: 'ios',
      width: headerWidth,
      x: headerOffsetX,
      y: headerY,
    },
    {
      height: titleHeight,
      id: `${id}.title`,
      platform: 'ios',
      width: headerWidth - 24,
      x: 0,
      y: 0,
    },
    {
      height: subtitleHeight,
      id: `${id}.subtitle`,
      platform: 'ios',
      width: headerWidth,
      x: headerOffsetX,
      y: subtitleY,
    },
    {
      height: 20,
      id: `${id}.footer`,
      platform: 'ios',
      width: headerWidth,
      x: headerOffsetX,
      y: footerY,
    },
  ]
}

function folderMetric(id: string, contentX: number, y = 0): NativeLayoutMetric[] {
  return [
    {
      height: 30,
      id: `${id}.row`,
      platform: 'ios',
      width: 247.5,
      x: 0,
      y,
    },
    {
      height: 18,
      id: `${id}.content`,
      platform: 'ios',
      width: 219.5,
      x: contentX,
      y: 6,
    },
    {
      height: desktopSidebarParity.itemLabelLineHeight,
      id: `${id}.label`,
      platform: 'ios',
      width: 172.5,
      x: 52,
      y: 0,
    },
  ]
}

function folderTreeRootMetric(
  y: number,
  {
    height = 120,
    x = 0,
  }: {
    height?: number
    x?: number
  } = {},
): NativeLayoutMetric[] {
  return [
    {
      height,
      id: 'sidebar.folderTree.root',
      platform: 'ios',
      width: 247.5,
      x,
      y,
    },
  ]
}

function sectionMetric(sectionId: string, rowHeight = 30): NativeLayoutMetric[] {
  const labelY = (rowHeight - desktopSidebarParity.sectionTitleLineHeight) / 2

  return [
    {
      height: rowHeight,
      id: `sidebar.section.${sectionId}.row`,
      platform: 'ios',
      width: 247.5,
      x: 6,
      y: 0,
    },
    {
      height: desktopSidebarParity.sectionTitleLineHeight,
      id: `sidebar.section.${sectionId}.label`,
      platform: 'ios',
      width: 206.5,
      x: 27,
      y: labelY,
    },
  ]
}

function containerMetric({ height, id, width = 247.5, x = 0, y = 0 }: { height: number; id: string; width?: number; x?: number; y?: number }): NativeLayoutMetric {
  return {
    height,
    id,
    platform: 'ios',
    width,
    x,
    y,
  }
}
