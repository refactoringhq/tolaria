import {
  assertNativePropertiesLayoutMetrics,
  nativePropertiesMetricContract,
} from './nativePropertiesLayoutMetrics.ts'
import {
  phoneWorkspaceSidebarDrawerMaxWidth,
  phoneWorkspaceSidebarDrawerWidth,
  phoneWorkspaceSidebarDrawerWidthRatio,
} from '../screens/phoneWorkspaceTransitions.ts'

export { nativePropertiesMetricContract } from './nativePropertiesLayoutMetrics.ts'

export type NativeLayoutMetric = {
  height: number
  id: string
  platform: string
  width: number
  x: number
  y: number
}

export type NativeLayoutMetricMap = Record<string, NativeLayoutMetric>

export type NativeLayoutAssertionFailure = {
  actual: number | null
  expected: number
  id: string
  message: string
}

export type NativePhoneLayoutState = 'editor' | 'list' | 'properties' | 'sidebar'

type SidebarPadding = {
  bottom: number
  left: number
  right: number
  top: number
}

type CountPillLayout = {
  compact?: boolean
  id: string
}

type LayoutExpectation = {
  actual: number | null
  expected: number
  id: string
  message: string
}

type MetricExpectation = {
  id: string
  message: string
  metric: NativeLayoutMetric | undefined
}

type SidebarItemMetricSpec = {
  contentHeight: number
  id: string
  padding: SidebarPadding
}

type SidebarItemMetrics = {
  content: NativeLayoutMetric | undefined
  label: NativeLayoutMetric | undefined
  row: NativeLayoutMetric | undefined
}

type NoteListItemMetricSpec = {
  id: string
}

type NoteListItemMetrics = {
  body: NativeLayoutMetric | undefined
  footer: NativeLayoutMetric | undefined
  frame: NativeLayoutMetric | undefined
  header: NativeLayoutMetric | undefined
  subtitle: NativeLayoutMetric | undefined
  title: NativeLayoutMetric | undefined
}

type PhoneShellMetrics = {
  root: NativeLayoutMetric | undefined
  screen: NativeLayoutMetric | undefined
}

type WysiwygEditorMetrics = {
  form: NativeLayoutMetric | undefined
  richText: NativeLayoutMetric | undefined
  toolbar: NativeLayoutMetric | undefined
  toolbarHost: NativeLayoutMetric | undefined
}

type SectionTitleMetricSpec = {
  firstContentMetricId?: string
  sectionId: string
}

type FolderTreeMetrics = {
  root: NativeLayoutMetric | undefined
  tolaria: NativeLayoutMetric | undefined
  tolariaMobile: NativeLayoutMetric | undefined
  tolariaReleases: NativeLayoutMetric | undefined
  writing: NativeLayoutMetric | undefined
  writingDrafts: NativeLayoutMetric | undefined
  writingEssays: NativeLayoutMetric | undefined
}

const metricPrefix = 'TOLARIA_MOBILE_LAYOUT_METRIC'
const layoutTolerance = 1.5
const sidebarSectionOrder = ['primary', 'favorites', 'views', 'types', 'folders']
const wysiwygToolbarActionMetricIds = [
  'editor.wysiwyg.toolbar.action.bold',
  'editor.wysiwyg.toolbar.action.italic',
  'editor.wysiwyg.toolbar.action.link',
  'editor.wysiwyg.toolbar.action.wikilink',
  'editor.wysiwyg.toolbar.group.headings',
  'editor.wysiwyg.toolbar.group.lists',
  'editor.wysiwyg.toolbar.group.insert',
  'editor.wysiwyg.toolbar.group.more',
] as const
export const nativeSidebarMetricContract = {
  countPill: {
    compactHeight: 18,
    height: 20,
  },
  folderSectionContentPaddingBottom: 8,
  folderRowContentHeight: 18,
  folderRowContentInset: 12,
  folderRowHeight: 30,
  folderRowIndent: 25,
  itemContentHeight: {
    regular: 18,
    withCount: 20,
  },
  itemLabelLineHeight: 18,
  itemPadding: {
    regular: { bottom: 6, left: 12, right: 16, top: 6 },
    withCount: { bottom: 6, left: 12, right: 8, top: 6 },
  },
  primarySectionItemCount: 3,
  sectionHorizontalPadding: 6,
  sectionTitleMinHeight: 30,
  sectionTitleLineHeight: 14,
  topNavPadding: { bottom: 4, left: 6, right: 6, top: 4 },
} as const

export const nativeNoteListMetricContract = {
  contentGap: 8,
  frameX: 0,
  panelWidth: 340,
  padding: { bottom: 14, left: 16, right: 16, top: 14 },
  titleLineHeight: 18,
} as const

export const nativeWysiwygEditorMetricContract = {
  minFormHeight: 320,
  toolbarActionCount: wysiwygToolbarActionMetricIds.length,
  toolbarActionGap: 4,
  toolbarActionSize: 44,
  toolbarHostPaddingHorizontal: 12,
  toolbarHostPaddingTop: 4,
} as const

export const nativePhoneShellMetricContract = {
  drawerMaxWidth: phoneWorkspaceSidebarDrawerMaxWidth,
  drawerWidthRatio: phoneWorkspaceSidebarDrawerWidthRatio,
  maxWidth: 899,
  minContentHeight: 320,
  minRootHeight: 480,
} as const

const sidebarItemMetricSpecs: SidebarItemMetricSpec[] = [
  { contentHeight: nativeSidebarMetricContract.itemContentHeight.withCount, id: 'sidebar.item.inbox', padding: nativeSidebarMetricContract.itemPadding.withCount },
  { contentHeight: nativeSidebarMetricContract.itemContentHeight.withCount, id: 'sidebar.item.all-notes', padding: nativeSidebarMetricContract.itemPadding.withCount },
  { contentHeight: nativeSidebarMetricContract.itemContentHeight.withCount, id: 'sidebar.item.archive', padding: nativeSidebarMetricContract.itemPadding.withCount },
  { contentHeight: nativeSidebarMetricContract.itemContentHeight.regular, id: 'sidebar.item.personal-journal', padding: nativeSidebarMetricContract.itemPadding.regular },
  { contentHeight: nativeSidebarMetricContract.itemContentHeight.regular, id: 'sidebar.item.tolaria-mvp', padding: nativeSidebarMetricContract.itemPadding.regular },
  { contentHeight: nativeSidebarMetricContract.itemContentHeight.withCount, id: 'sidebar.item.view-active-procedures', padding: nativeSidebarMetricContract.itemPadding.withCount },
  { contentHeight: nativeSidebarMetricContract.itemContentHeight.withCount, id: 'sidebar.item.essays', padding: nativeSidebarMetricContract.itemPadding.withCount },
  { contentHeight: nativeSidebarMetricContract.itemContentHeight.withCount, id: 'sidebar.item.procedures', padding: nativeSidebarMetricContract.itemPadding.withCount },
  { contentHeight: nativeSidebarMetricContract.itemContentHeight.withCount, id: 'sidebar.item.responsibilities', padding: nativeSidebarMetricContract.itemPadding.withCount },
]
const primarySidebarItemMetricIds = ['sidebar.item.inbox', 'sidebar.item.all-notes', 'sidebar.item.archive'] as const
const fixtureTypeSidebarItemMetricIds = ['sidebar.item.essays', 'sidebar.item.procedures', 'sidebar.item.responsibilities'] as const
const sidebarItemPrefix = 'sidebar.item.'
const sidebarItemRowSuffix = '.row'
const sidebarCountContainerSuffix = '.count.container'

const sidebarItemRowOrder = [
  ['sidebar.item.inbox', 'sidebar.item.all-notes', 'sidebar.item.archive'],
  ['sidebar.item.personal-journal', 'sidebar.item.tolaria-mvp'],
  ['sidebar.item.essays', 'sidebar.item.procedures', 'sidebar.item.responsibilities'],
] as const

const folderMetricSpecs = [
  { expectedLeftInset: nativeSidebarMetricContract.folderRowContentInset, id: 'sidebar.folder.writing' },
  { expectedLeftInset: nativeSidebarMetricContract.folderRowContentInset + nativeSidebarMetricContract.folderRowIndent, id: 'sidebar.folder.writing-essays' },
  { expectedLeftInset: nativeSidebarMetricContract.folderRowContentInset + nativeSidebarMetricContract.folderRowIndent, id: 'sidebar.folder.writing-drafts' },
  { expectedLeftInset: nativeSidebarMetricContract.folderRowContentInset, id: 'sidebar.folder.tolaria' },
  { expectedLeftInset: nativeSidebarMetricContract.folderRowContentInset + nativeSidebarMetricContract.folderRowIndent, id: 'sidebar.folder.tolaria-mobile-ui' },
  { expectedLeftInset: nativeSidebarMetricContract.folderRowContentInset + nativeSidebarMetricContract.folderRowIndent, id: 'sidebar.folder.tolaria-releases' },
] as const
const sidebarFolderPrefix = 'sidebar.folder.'
const sidebarFolderContainerSuffix = '.container'
const sidebarFolderRowSuffix = '.row'

const countPillMetricSpecs: CountPillLayout[] = [
  { id: 'sidebar.item.inbox.count' },
  { id: 'sidebar.item.all-notes.count' },
  { id: 'sidebar.item.archive.count' },
  { id: 'sidebar.item.view-active-procedures.count' },
  { id: 'sidebar.item.essays.count' },
  { id: 'sidebar.item.procedures.count' },
  { id: 'sidebar.item.responsibilities.count' },
  { compact: true, id: 'sidebar.section.types.count' },
]

const noteListItemMetricSpecs: NoteListItemMetricSpec[] = [
  { id: 'noteList.item.workflow-orchestration' },
  { id: 'noteList.item.open-source-project' },
]
const noteListItemFrameSuffix = '.frame'
const noteListItemPrefix = 'noteList.item.'

const sectionTitleMetricSpecs: SectionTitleMetricSpec[] = [
  { firstContentMetricId: 'sidebar.item.personal-journal.row', sectionId: 'favorites' },
  { firstContentMetricId: 'sidebar.item.view-active-procedures.row', sectionId: 'views' },
  { firstContentMetricId: 'sidebar.item.essays.row', sectionId: 'types' },
  { firstContentMetricId: 'sidebar.folderTree.root', sectionId: 'folders' },
]

export function parseNativeLayoutMetrics(logText: string): NativeLayoutMetric[] {
  const metrics: NativeLayoutMetric[] = []

  for (const line of logText.split('\n')) {
    const prefixIndex = line.indexOf(metricPrefix)
    if (prefixIndex === -1) continue

    const rawJson = line.slice(prefixIndex + metricPrefix.length).trim()
    const metric = parseMetric(rawJson)
    if (metric) metrics.push(metric)
  }

  return metrics
}

export function latestNativeLayoutMetrics(metrics: NativeLayoutMetric[]): NativeLayoutMetricMap {
  return Object.fromEntries(metrics.map((metric) => [metric.id, metric]))
}

export function assertNativeSidebarLayoutMetrics(metrics: NativeLayoutMetricMap): NativeLayoutAssertionFailure[] {
  return [
    ...assertSidebarSectionLayouts(metrics),
    ...assertSidebarItemLayouts(metrics),
    ...assertSectionTitleLayouts(metrics),
    ...assertFolderTreeLayout(metrics),
    ...assertFolderLayouts(metrics),
    ...assertCountPillLayouts(metrics),
  ]
}

export function assertNativeMobileLayoutMetrics(metrics: NativeLayoutMetricMap): NativeLayoutAssertionFailure[] {
  return [
    ...assertNativeSidebarLayoutMetrics(metrics),
    ...assertNativeNoteListLayoutMetrics(metrics),
    ...assertNativePropertiesLayoutMetrics({
      expectedPanelWidth: nativePropertiesMetricContract.panelWidth,
      metrics,
    }),
  ]
}

export function assertNativePhoneLayoutMetrics(
  metrics: NativeLayoutMetricMap,
  state: NativePhoneLayoutState,
): NativeLayoutAssertionFailure[] {
  return [
    ...assertNativePhoneShellMetrics(metrics, state),
    ...assertNativePhoneContentMetrics(metrics, state),
  ]
}

export const assertNativeWysiwygEditorLayoutMetrics = (
  metrics: NativeLayoutMetricMap,
): NativeLayoutAssertionFailure[] => {
  const editor = wysiwygEditorMetrics(metrics)

  return [
    ...assertWysiwygEditorSurfaceLayout(editor),
    ...assertWysiwygToolbarActionLayouts(metrics),
  ]
};

const wysiwygEditorMetrics = (metrics: NativeLayoutMetricMap): WysiwygEditorMetrics => {
  return {
    form: metrics['editor.wysiwyg.form'],
    richText: metrics['editor.wysiwyg.richText'],
    toolbar: metrics['editor.wysiwyg.toolbar'],
    toolbarHost: metrics['editor.wysiwyg.toolbarHost'],
  }
};

const assertWysiwygEditorSurfaceLayout = (editor: WysiwygEditorMetrics): NativeLayoutAssertionFailure[] => {
  return [
    ...assertWysiwygEditorMetricsCaptured(editor),
    ...assertWysiwygEditorFormLayout(editor),
    ...assertWysiwygToolbarHostLayout(editor),
    ...assertWysiwygToolbarInsetLayout(editor),
  ]
};

const assertWysiwygEditorMetricsCaptured = (editor: WysiwygEditorMetrics): NativeLayoutAssertionFailure[] => {
  return [
    ...expectMetric({
      id: 'editor.wysiwyg.form',
      message: 'WYSIWYG editor form is captured before checking native editor layout',
      metric: editor.form,
    }),
    ...expectMetric({
      id: 'editor.wysiwyg.richText',
      message: 'WYSIWYG editor content surface is captured before checking native editor layout',
      metric: editor.richText,
    }),
    ...expectMetric({
      id: 'editor.wysiwyg.toolbarHost',
      message: 'WYSIWYG toolbar host is captured before checking native editor layout',
      metric: editor.toolbarHost,
    }),
    ...expectMetric({
      id: 'editor.wysiwyg.toolbar',
      message: 'WYSIWYG toolbar is captured before checking native editor layout',
      metric: editor.toolbar,
    }),
  ]
};

const assertWysiwygEditorFormLayout = (editor: WysiwygEditorMetrics): NativeLayoutAssertionFailure[] => {
  return [
    ...expectAtLeast({
      actual: editor.form?.height ?? null,
      expected: nativeWysiwygEditorMetricContract.minFormHeight,
      id: 'editor.wysiwyg.form',
      message: 'WYSIWYG editor keeps a usable native editing surface',
    }),
  ]
};

const assertWysiwygToolbarHostLayout = (editor: WysiwygEditorMetrics): NativeLayoutAssertionFailure[] => {
  return [
    ...expectClose({
      actual: editor.toolbarHost?.x ?? null,
      expected: 0,
      id: 'editor.wysiwyg.toolbarHost',
      message: 'WYSIWYG toolbar host starts at the editor edge',
    }),
    ...expectClose({
      actual: editor.form && editor.toolbarHost ? editor.form.width - editor.toolbarHost.width : null,
      expected: 0,
      id: 'editor.wysiwyg.toolbarHost',
      message: 'WYSIWYG toolbar host spans the editor width',
    }),
    ...expectClose({
      actual: editor.form && editor.toolbarHost
        ? editor.form.height - editor.toolbarHost.y - editor.toolbarHost.height
        : null,
      expected: 0,
      id: 'editor.wysiwyg.toolbarHost',
      message: 'WYSIWYG toolbar stays pinned to the editor bottom',
    }),
  ]
};

const assertWysiwygToolbarInsetLayout = (editor: WysiwygEditorMetrics): NativeLayoutAssertionFailure[] => {
  return [
    ...expectClose({
      actual: editor.toolbar?.x ?? null,
      expected: nativeWysiwygEditorMetricContract.toolbarHostPaddingHorizontal,
      id: 'editor.wysiwyg.toolbar',
      message: 'WYSIWYG toolbar keeps desktop horizontal inset',
    }),
    ...expectClose({
      actual: editor.toolbar?.y ?? null,
      expected: nativeWysiwygEditorMetricContract.toolbarHostPaddingTop,
      id: 'editor.wysiwyg.toolbar',
      message: 'WYSIWYG toolbar keeps desktop top inset',
    }),
  ]
};

const assertWysiwygToolbarActionLayouts = (metrics: NativeLayoutMetricMap): NativeLayoutAssertionFailure[] => {
  return [
    ...wysiwygToolbarActionMetricIds.flatMap((id) => assertWysiwygToolbarActionSize(id, metrics[id])),
    ...assertWysiwygToolbarActionSequence(metrics),
  ]
};

const assertWysiwygToolbarActionSize = (
  id: string,
  action: NativeLayoutMetric | undefined,
): NativeLayoutAssertionFailure[] => {
  return [
    ...expectMetric({
      id,
      message: 'WYSIWYG toolbar action is captured before checking native toolbar parity',
      metric: action,
    }),
    ...expectClose({
      actual: action?.width ?? null,
      expected: nativeWysiwygEditorMetricContract.toolbarActionSize,
      id,
      message: 'WYSIWYG toolbar action keeps tablet touch target width',
    }),
    ...expectClose({
      actual: action?.height ?? null,
      expected: nativeWysiwygEditorMetricContract.toolbarActionSize,
      id,
      message: 'WYSIWYG toolbar action keeps tablet touch target height',
    }),
  ]
};

const assertWysiwygToolbarActionSequence = (metrics: NativeLayoutMetricMap): NativeLayoutAssertionFailure[] => {
  return wysiwygToolbarActionMetricIds.slice(1).flatMap((id, index) => {
    const previous = metrics[wysiwygToolbarActionMetricIds[index]]
    const current = metrics[id]

    return [
      ...expectClose({
        actual: previous && current ? current.x - previous.x - previous.width : null,
        expected: nativeWysiwygEditorMetricContract.toolbarActionGap,
        id,
        message: 'WYSIWYG toolbar action keeps desktop action gap',
      }),
      ...expectClose({
        actual: previous && current ? current.y - previous.y : null,
        expected: 0,
        id,
        message: 'WYSIWYG toolbar actions stay aligned on the same row',
      }),
    ]
  })
};

function assertNativeNoteListLayoutMetrics(metrics: NativeLayoutMetricMap): NativeLayoutAssertionFailure[] {
  return [
    ...assertNoteListPanelLayout(metrics),
    ...noteListItemMetricSpecsForMetrics(metrics).flatMap((spec) => assertNoteListItemLayout({ ...spec, metrics })),
  ]
}

function assertNativePhoneContentMetrics(
  metrics: NativeLayoutMetricMap,
  state: NativePhoneLayoutState,
): NativeLayoutAssertionFailure[] {
  if (state === 'list') return assertNativePhoneNoteListLayoutMetrics(metrics)
  if (state === 'sidebar') {
    return [
      ...assertNativePhoneSidebarLayoutMetrics(metrics),
      ...assertNativeSidebarLayoutMetrics(metrics),
      ...assertNativePhoneNoteListLayoutMetrics(metrics),
    ]
  }
  if (state === 'properties') {
    const root = metrics['phone.root']
    return assertNativePropertiesLayoutMetrics({
      expectedPanelWidth: root?.width ?? nativePhoneShellMetricContract.maxWidth,
      metrics,
    })
  }

  return []
}

function assertNativePhoneShellMetrics(
  metrics: NativeLayoutMetricMap,
  state: NativePhoneLayoutState,
): NativeLayoutAssertionFailure[] {
  const shell = phoneShellMetrics(metrics, state)

  return [
    ...expectMetric({
      id: 'phone.root',
      message: 'phone root is captured before checking native phone layout',
      metric: shell.root,
    }),
    ...expectMetric({
      id: `phone.${state}.screen`,
      message: 'active phone screen is captured before checking native phone layout',
      metric: shell.screen,
    }),
    ...expectAtLeast({
      actual: shell.root?.height ?? null,
      expected: nativePhoneShellMetricContract.minRootHeight,
      id: 'phone.root',
      message: 'phone root keeps enough vertical space for native workspace chrome',
    }),
    ...expectAtMost({
      actual: shell.root?.width ?? null,
      expected: nativePhoneShellMetricContract.maxWidth,
      id: 'phone.root',
      message: 'phone layout metric is captured on the compact phone breakpoint',
    }),
    ...expectClose({
      actual: shell.root && shell.screen ? shell.screen.width - shell.root.width : null,
      expected: 0,
      id: `phone.${state}.screen`,
      message: 'active phone screen spans the phone root width',
    }),
    ...expectAtLeast({
      actual: shell.screen?.height ?? null,
      expected: nativePhoneShellMetricContract.minContentHeight,
      id: `phone.${state}.screen`,
      message: 'active phone screen keeps usable content height',
    }),
  ]
}

function phoneShellMetrics(metrics: NativeLayoutMetricMap, state: NativePhoneLayoutState): PhoneShellMetrics {
  return {
    root: metrics['phone.root'],
    screen: metrics[`phone.${state}.screen`],
  }
}

function assertNativePhoneSidebarLayoutMetrics(metrics: NativeLayoutMetricMap): NativeLayoutAssertionFailure[] {
  const root = metrics['phone.root']
  const drawer = metrics['phone.sidebar.drawer']
  const preview = metrics['phone.sidebar.preview']
  const expectedDrawerWidth = root ? phoneSidebarDrawerWidth(root.width) : nativePhoneShellMetricContract.drawerMaxWidth

  return [
    ...expectMetric({
      id: 'phone.sidebar.drawer',
      message: 'phone sidebar drawer is captured before checking native drawer layout',
      metric: drawer,
    }),
    ...expectMetric({
      id: 'phone.sidebar.preview',
      message: 'phone sidebar preview is captured before checking native drawer layout',
      metric: preview,
    }),
    ...expectClose({
      actual: drawer?.x ?? null,
      expected: 0,
      id: 'phone.sidebar.drawer',
      message: 'phone sidebar drawer starts at the root leading edge',
    }),
    ...expectClose({
      actual: drawer?.width ?? null,
      expected: expectedDrawerWidth,
      id: 'phone.sidebar.drawer',
      message: 'phone sidebar drawer keeps the compact navigation width',
    }),
    ...expectClose({
      actual: preview?.x ?? null,
      expected: expectedDrawerWidth,
      id: 'phone.sidebar.preview',
      message: 'phone sidebar keeps the note-list preview attached to the drawer edge',
    }),
    ...expectClose({
      actual: preview && root ? preview.width - root.width : null,
      expected: 0,
      id: 'phone.sidebar.preview',
      message: 'phone sidebar preview preserves the full note-list surface width',
    }),
  ]
}

function phoneSidebarDrawerWidth(rootWidth: number) {
  return phoneWorkspaceSidebarDrawerWidth(rootWidth)
}

function assertNativePhoneNoteListLayoutMetrics(metrics: NativeLayoutMetricMap): NativeLayoutAssertionFailure[] {
  const panel = metrics['noteList.panel']

  return [
    ...expectMetric({
      id: 'noteList.panel',
      message: 'phone note-list panel is captured before checking native note row spacing',
      metric: panel,
    }),
    ...noteListItemMetricSpecsForMetrics(metrics).flatMap((spec) => assertPhoneNoteListItemLayout({ ...spec, metrics, panel })),
  ]
}

function noteListItemMetricSpecsForMetrics(metrics: NativeLayoutMetricMap): NoteListItemMetricSpec[] {
  const liveRowIds = noteListItemMetricIds(metrics)
  if (liveRowIds.length === 0) return noteListItemMetricSpecs

  return liveRowIds.slice(0, noteListItemMetricSpecs.length).map((id) => ({ id }))
}

function noteListItemMetricIds(metrics: NativeLayoutMetricMap): string[] {
  return Object.keys(metrics)
    .filter((id) => id.startsWith(noteListItemPrefix) && id.endsWith(noteListItemFrameSuffix))
    .map((id) => id.slice(0, -noteListItemFrameSuffix.length))
}

function assertPhoneNoteListItemLayout({
  id,
  metrics,
  panel,
}: {
  id: string
  metrics: NativeLayoutMetricMap
  panel: NativeLayoutMetric | undefined
}): NativeLayoutAssertionFailure[] {
  const item = noteListItemMetrics(id, metrics)

  return [
    ...assertNoteListItemMetricsCaptured(id, item),
    ...assertPhoneNoteListItemSurfaceLayout(id, item, panel),
    ...assertNoteListItemContentLayout(id, item),
    ...assertNoteListItemTextLayout(id, item),
  ]
}

function assertPhoneNoteListItemSurfaceLayout(
  id: string,
  item: NoteListItemMetrics,
  panel: NativeLayoutMetric | undefined,
): NativeLayoutAssertionFailure[] {
  return [
    ...expectClose({
      actual: item.frame?.x ?? null,
      expected: nativeNoteListMetricContract.frameX,
      id: `${id}.frame`,
      message: 'phone note row surface starts at the note-list edge',
    }),
    ...expectClose({
      actual: item.frame && panel ? item.frame.width - panel.width : null,
      expected: 0,
      id: `${id}.frame`,
      message: 'phone note row surface fills the phone note-list panel',
    }),
  ]
}

function assertSidebarSectionLayouts(metrics: NativeLayoutMetricMap): NativeLayoutAssertionFailure[] {
  return [
    ...assertPrimarySectionLayout(metrics),
    ...assertStackedSections(metrics, sidebarSectionOrder),
  ]
}

function assertSidebarItemLayouts(metrics: NativeLayoutMetricMap): NativeLayoutAssertionFailure[] {
  return [
    ...sidebarItemMetricSpecsForMetrics(metrics).flatMap((spec) => assertSidebarItemLayout({ ...spec, metrics })),
    ...sidebarItemRowOrderForMetrics(metrics).flatMap((ids) => assertStackedRows(metrics, ids)),
  ]
}

function assertSectionTitleLayouts(metrics: NativeLayoutMetricMap): NativeLayoutAssertionFailure[] {
  return sectionTitleMetricSpecsForMetrics(metrics).flatMap((spec) => assertSectionTitleLayout({ ...spec, metrics }))
}

function assertFolderLayouts(metrics: NativeLayoutMetricMap): NativeLayoutAssertionFailure[] {
  return folderMetricSpecsForMetrics(metrics).flatMap((spec) => assertFolderLayout({ ...spec, metrics }))
}

function sidebarItemMetricSpecsForMetrics(metrics: NativeLayoutMetricMap): SidebarItemMetricSpec[] {
  const ids = sidebarItemMetricIds(metrics)
  if (ids.length === 0) return sidebarItemMetricSpecs

  const countIds = countPillIds(metrics)
  return ids.map((id) => {
    const hasCount = countIds.has(`${id}.count`)
    return {
      contentHeight: hasCount
        ? nativeSidebarMetricContract.itemContentHeight.withCount
        : nativeSidebarMetricContract.itemContentHeight.regular,
      id,
      padding: hasCount
        ? nativeSidebarMetricContract.itemPadding.withCount
        : nativeSidebarMetricContract.itemPadding.regular,
    }
  })
}

function sidebarItemMetricIds(metrics: NativeLayoutMetricMap): string[] {
  return Object.keys(metrics)
    .filter((id) => id.startsWith(sidebarItemPrefix) && id.endsWith(sidebarItemRowSuffix))
    .map((id) => id.slice(0, -sidebarItemRowSuffix.length))
}

function sidebarItemRowOrderForMetrics(metrics: NativeLayoutMetricMap): string[][] {
  const ids = sidebarItemMetricIds(metrics)
  if (ids.length === 0) return sidebarItemRowOrder.map((group) => [...group])

  const primary = primarySidebarItemMetricIds.filter((id) => ids.includes(id))
  const views = ids.filter((id) => id.startsWith('sidebar.item.view-'))
  const types = ids.filter(isTypeSidebarItemMetricId)
  const favorites = ids.filter((id) => !isPrimarySidebarItemMetricId(id) && !views.includes(id) && !types.includes(id))

  return [primary, favorites, views, types].filter((group) => group.length > 1)
}

function sectionTitleMetricSpecsForMetrics(metrics: NativeLayoutMetricMap): SectionTitleMetricSpec[] {
  const ids = sidebarItemMetricIds(metrics)
  if (ids.length === 0) return sectionTitleMetricSpecs

  const groups = sidebarItemRowOrderForMetrics(metrics)
  const favorites = groups.find((group) => group.some((id) => !isPrimarySidebarItemMetricId(id) && !id.startsWith('sidebar.item.view-') && !isTypeSidebarItemMetricId(id)))
  const views = groups.find((group) => group.some((id) => id.startsWith('sidebar.item.view-')))
  const types = groups.find((group) => group.some(isTypeSidebarItemMetricId))

  return [
    { firstContentMetricId: firstSidebarRow(favorites), sectionId: 'favorites' },
    { firstContentMetricId: firstSidebarRow(views), sectionId: 'views' },
    { firstContentMetricId: firstSidebarRow(types), sectionId: 'types' },
    { firstContentMetricId: metrics['sidebar.folderTree.root'] ? 'sidebar.folderTree.root' : undefined, sectionId: 'folders' },
  ]
}

function firstSidebarRow(group: string[] | undefined) {
  return group?.[0] ? `${group[0]}.row` : undefined
}

function isPrimarySidebarItemMetricId(id: string): boolean {
  return primarySidebarItemMetricIds.includes(id as typeof primarySidebarItemMetricIds[number])
}

function isTypeSidebarItemMetricId(id: string): boolean {
  return id.startsWith('sidebar.item.type-')
    || fixtureTypeSidebarItemMetricIds.includes(id as typeof fixtureTypeSidebarItemMetricIds[number])
}

function folderMetricSpecsForMetrics(metrics: NativeLayoutMetricMap): Array<{ expectedLeftInset: number; id: string }> {
  const ids = sidebarFolderMetricIds(metrics)
  if (ids.length === 0) return [...folderMetricSpecs]

  return ids.map((id) => ({
    expectedLeftInset: expectedFolderLeftInset(metrics[`${id}.content`]?.x ?? null),
    id,
  }))
}

function sidebarFolderMetricIds(metrics: NativeLayoutMetricMap): string[] {
  return Object.keys(metrics)
    .filter((id) => id.startsWith(sidebarFolderPrefix) && id.endsWith(sidebarFolderRowSuffix))
    .map((id) => id.slice(0, -sidebarFolderRowSuffix.length))
}

function expectedFolderLeftInset(actual: number | null): number {
  if (actual === null) return nativeSidebarMetricContract.folderRowContentInset

  const depth = Math.max(
    0,
    Math.round((actual - nativeSidebarMetricContract.folderRowContentInset) / nativeSidebarMetricContract.folderRowIndent),
  )
  return nativeSidebarMetricContract.folderRowContentInset + depth * nativeSidebarMetricContract.folderRowIndent
}

function assertPrimarySectionLayout(metrics: NativeLayoutMetricMap): NativeLayoutAssertionFailure[] {
  const container = metrics['sidebar.section.primary.container']
  const firstRow = metrics['sidebar.item.inbox.row']
  const lastRow = metrics['sidebar.item.archive.row']

  return [
    ...expectMetric({
      id: 'sidebar.section.primary',
      message: 'primary section container is captured before checking native sidebar spacing',
      metric: container,
    }),
    ...expectClose({
      actual: firstRow?.y ?? null,
      expected: nativeSidebarMetricContract.topNavPadding.top,
      id: 'sidebar.section.primary',
      message: 'primary section keeps desktop top padding',
    }),
    ...expectClose({
      actual: firstRow?.x ?? null,
      expected: nativeSidebarMetricContract.topNavPadding.left,
      id: 'sidebar.section.primary',
      message: 'primary section keeps desktop left padding',
    }),
    ...expectClose({
      actual: container && lastRow ? container.height - lastRow.y - lastRow.height : null,
      expected: nativeSidebarMetricContract.topNavPadding.bottom,
      id: 'sidebar.section.primary',
      message: 'primary section keeps desktop bottom padding',
    }),
  ]
}

function assertStackedSections(metrics: NativeLayoutMetricMap, ids: string[]): NativeLayoutAssertionFailure[] {
  return ids.slice(1).flatMap((id, index) => {
    const previousId = ids[index]
    const previous = metrics[`sidebar.section.${previousId}.container`]
    const current = metrics[`sidebar.section.${id}.container`]

    return [
      ...expectMetric({
        id: previousId,
        message: 'previous sidebar section is captured before checking section stacking',
        metric: previous,
      }),
      ...expectMetric({
        id,
        message: 'sidebar section is captured before checking section stacking',
        metric: current,
      }),
      ...expectClose({
        actual: previous && current ? current.y - previous.y - previous.height : null,
        expected: 0,
        id,
        message: 'section starts exactly after the previous sidebar section',
      }),
    ]
  })
}

function assertStackedRows(metrics: NativeLayoutMetricMap, ids: readonly string[]): NativeLayoutAssertionFailure[] {
  return ids.slice(1).flatMap((id, index) => {
    const previous = metrics[`${ids[index]}.row`]
    const current = metrics[`${id}.row`]

    return [
      ...expectMetric({
        id: ids[index],
        message: 'previous row is captured before checking sidebar row stacking',
        metric: previous,
      }),
      ...expectMetric({
        id,
        message: 'row is captured before checking sidebar row stacking',
        metric: current,
      }),
      ...expectClose({
        actual: previous && current ? current.y - previous.y - previous.height : null,
        expected: 0,
        id,
        message: 'row starts exactly after the previous sidebar row',
      }),
    ]
  })
}

function assertSectionTitleLayout({
  firstContentMetricId,
  metrics,
  sectionId,
}: {
  firstContentMetricId?: string
  metrics: NativeLayoutMetricMap
  sectionId: string
}): NativeLayoutAssertionFailure[] {
  const id = `sidebar.section.${sectionId}`
  const titleRow = metrics[`${id}.row`]
  const titleLabel = metrics[`${id}.label`]
  const firstContent = firstContentMetricId ? metrics[firstContentMetricId] : undefined

  return [
    ...expectMetric({
      id,
      message: 'section title row is captured before checking native sidebar spacing',
      metric: titleRow,
    }),
    ...expectMetric({
      id,
      message: 'section title label is captured before checking native text alignment',
      metric: titleLabel,
    }),
    ...expectClose({
      actual: titleRow?.x ?? null,
      expected: nativeSidebarMetricContract.sectionHorizontalPadding,
      id,
      message: 'section title keeps desktop section inset',
    }),
    ...expectAtLeast({
      actual: titleRow?.height ?? null,
      expected: nativeSidebarMetricContract.sectionTitleMinHeight,
      id,
      message: 'section title keeps desktop header height',
    }),
    ...expectClose({
      actual: titleLabel?.height ?? null,
      expected: nativeSidebarMetricContract.sectionTitleLineHeight,
      id,
      message: 'section title label keeps desktop line height',
    }),
    ...expectClose({
      actual: titleLabel?.y ?? null,
      expected: titleRow
        ? (titleRow.height - nativeSidebarMetricContract.sectionTitleLineHeight) / 2
        : (nativeSidebarMetricContract.sectionTitleMinHeight - nativeSidebarMetricContract.sectionTitleLineHeight) / 2,
      id,
      message: 'section title label keeps desktop vertical placement',
    }),
    ...assertSectionFirstContentLayout({ firstContent, firstContentMetricId, titleRow }),
  ]
}

function assertSectionFirstContentLayout({
  firstContent,
  firstContentMetricId,
  titleRow,
}: {
  firstContent: NativeLayoutMetric | undefined
  firstContentMetricId: string | undefined
  titleRow: NativeLayoutMetric | undefined
}): NativeLayoutAssertionFailure[] {
  if (!firstContentMetricId) return []

  return [
    ...expectMetric({
      id: firstContentMetricId,
      message: 'first section content is captured before checking native sidebar spacing',
      metric: firstContent,
    }),
    ...expectClose({
      actual: titleRow && firstContent ? firstContent.y - titleRow.y - titleRow.height : null,
      expected: 0,
      id: firstContentMetricId,
      message: 'first row starts exactly after the sidebar section title',
    }),
  ]
}

export function formatNativeLayoutAssertionFailures(failures: NativeLayoutAssertionFailure[]) {
  return failures
    .map((failure) => {
      const actual = failure.actual === null ? 'missing' : failure.actual.toFixed(1)
      return `${failure.id}: ${failure.message}; expected ${failure.expected.toFixed(1)}, got ${actual}`
    })
    .join('\n')
}

function assertSidebarItemLayout({
  contentHeight,
  id,
  metrics,
  padding,
}: {
  contentHeight: number
  id: string
  metrics: NativeLayoutMetricMap
  padding: SidebarPadding
}): NativeLayoutAssertionFailure[] {
  const item = sidebarItemMetrics(id, metrics)

  return [
    ...assertSidebarItemMetricsCaptured(id, item),
    ...assertSidebarItemFrameLayout({ contentHeight, id, item, padding }),
    ...assertSidebarItemContentLayout({ contentHeight, id, item, padding }),
    ...assertSidebarItemLabelLayout({ contentHeight, id, item }),
  ]
}

function sidebarItemMetrics(id: string, metrics: NativeLayoutMetricMap): SidebarItemMetrics {
  return {
    content: metrics[`${id}.content`],
    label: metrics[`${id}.label`],
    row: metrics[`${id}.row`],
  }
}

function assertSidebarItemMetricsCaptured(id: string, item: SidebarItemMetrics): NativeLayoutAssertionFailure[] {
  return [
    ...expectMetric({ id, message: 'row is captured before checking native padding', metric: item.row }),
    ...expectMetric({ id, message: 'content is captured before checking native padding', metric: item.content }),
    ...expectMetric({ id, message: 'label is captured before checking native text alignment', metric: item.label }),
  ]
}

function assertSidebarItemFrameLayout({
  contentHeight,
  id,
  item,
  padding,
}: {
  contentHeight: number
  id: string
  item: SidebarItemMetrics
  padding: SidebarPadding
}): NativeLayoutAssertionFailure[] {
  return [
    ...expectClose({
      actual: item.row?.x ?? null,
      expected: nativeSidebarMetricContract.sectionHorizontalPadding,
      id,
      message: 'row keeps desktop section inset',
    }),
    ...expectClose({
      actual: item.row?.height ?? null,
      expected: padding.top + contentHeight + padding.bottom,
      id,
      message: 'row keeps desktop row height',
    }),
  ]
}

function assertSidebarItemContentLayout({
  contentHeight,
  id,
  item,
  padding,
}: {
  contentHeight: number
  id: string
  item: SidebarItemMetrics
  padding: SidebarPadding
}): NativeLayoutAssertionFailure[] {
  return [
    ...expectClose({
      actual: item.content?.x ?? null,
      expected: padding.left,
      id,
      message: 'content keeps desktop left padding',
    }),
    ...expectClose({
      actual: item.content?.y ?? null,
      expected: padding.top,
      id,
      message: 'content keeps desktop top padding',
    }),
    ...expectClose({
      actual: item.content?.height ?? null,
      expected: contentHeight,
      id,
      message: 'content keeps desktop content height',
    }),
    ...expectClose({
      actual: item.row && item.content ? item.row.width - item.content.x - item.content.width : null,
      expected: padding.right,
      id,
      message: 'content keeps desktop right padding',
    }),
    ...expectClose({
      actual: item.row && item.content ? item.row.height - item.content.height : null,
      expected: padding.top + padding.bottom,
      id,
      message: 'row keeps desktop vertical padding',
    }),
  ]
}

function assertSidebarItemLabelLayout({
  contentHeight,
  id,
  item,
}: {
  contentHeight: number
  id: string
  item: SidebarItemMetrics
}): NativeLayoutAssertionFailure[] {
  return [
    ...expectClose({
      actual: item.label?.height ?? null,
      expected: nativeSidebarMetricContract.itemLabelLineHeight,
      id,
      message: 'label keeps desktop line height',
    }),
    ...expectClose({
      actual: item.label?.y ?? null,
      expected: (contentHeight - nativeSidebarMetricContract.itemLabelLineHeight) / 2,
      id,
      message: 'label is vertically centered inside row content',
    }),
  ]
}

function assertNoteListPanelLayout(metrics: NativeLayoutMetricMap): NativeLayoutAssertionFailure[] {
  const panel = metrics['noteList.panel']

  return [
    ...expectMetric({
      id: 'noteList.panel',
      message: 'note-list panel is captured before checking native note row spacing',
      metric: panel,
    }),
    ...expectClose({
      actual: panel?.width ?? null,
      expected: nativeNoteListMetricContract.panelWidth,
      id: 'noteList.panel',
      message: 'note list keeps desktop column width',
    }),
  ]
}

function assertNoteListItemLayout({
  id,
  metrics,
}: {
  id: string
  metrics: NativeLayoutMetricMap
}): NativeLayoutAssertionFailure[] {
  const item = noteListItemMetrics(id, metrics)

  return [
    ...assertNoteListItemMetricsCaptured(id, item),
    ...assertNoteListItemSurfaceLayout(id, item),
    ...assertNoteListItemContentLayout(id, item),
    ...assertNoteListItemTextLayout(id, item),
  ]
}

function noteListItemMetrics(id: string, metrics: NativeLayoutMetricMap): NoteListItemMetrics {
  return {
    body: metrics[`${id}.body`],
    footer: metrics[`${id}.footer`],
    frame: metrics[`${id}.frame`],
    header: metrics[`${id}.header`],
    subtitle: metrics[`${id}.subtitle`],
    title: metrics[`${id}.title`],
  }
}

function assertNoteListItemMetricsCaptured(id: string, item: NoteListItemMetrics): NativeLayoutAssertionFailure[] {
  return [
    ...expectMetric({ id: `${id}.frame`, message: 'note row surface is captured before checking native note-list layout', metric: item.frame }),
    ...expectMetric({ id: `${id}.body`, message: 'note row body is captured before checking native note-list layout', metric: item.body }),
    ...expectMetric({ id: `${id}.header`, message: 'note row header is captured before checking native note-list layout', metric: item.header }),
    ...expectMetric({ id: `${id}.title`, message: 'note row title is captured before checking native note-list layout', metric: item.title }),
    ...expectMetric({ id: `${id}.subtitle`, message: 'note row preview is captured before checking native note-list layout', metric: item.subtitle }),
    ...expectMetric({ id: `${id}.footer`, message: 'note row footer is captured before checking native note-list layout', metric: item.footer }),
  ]
}

function assertNoteListItemSurfaceLayout(id: string, item: NoteListItemMetrics): NativeLayoutAssertionFailure[] {
  return [
    ...expectClose({
      actual: item.frame?.x ?? null,
      expected: nativeNoteListMetricContract.frameX,
      id: `${id}.frame`,
      message: 'note row surface starts at the note-list column edge',
    }),
    ...expectClose({
      actual: item.frame?.width ?? null,
      expected: nativeNoteListMetricContract.panelWidth,
      id: `${id}.frame`,
      message: 'note row surface fills the desktop note-list column',
    }),
  ]
}

function assertNoteListItemContentLayout(id: string, item: NoteListItemMetrics): NativeLayoutAssertionFailure[] {
  return [
    ...expectClose({
      actual: item.body && item.header ? item.body.x + item.header.x : null,
      expected: nativeNoteListMetricContract.padding.left,
      id: `${id}.header`,
      message: 'note row content keeps desktop horizontal padding',
    }),
    ...expectClose({
      actual: item.body && item.frame && item.header
        ? item.frame.width - item.body.x - item.header.x - item.header.width
        : null,
      expected: nativeNoteListMetricContract.padding.right,
      id: `${id}.header`,
      message: 'note row content keeps desktop right padding',
    }),
    ...expectClose({
      actual: item.body && item.header ? item.body.y + item.header.y : null,
      expected: nativeNoteListMetricContract.padding.top,
      id: `${id}.header`,
      message: 'note row content keeps desktop top padding',
    }),
  ]
}

function assertNoteListItemTextLayout(id: string, item: NoteListItemMetrics): NativeLayoutAssertionFailure[] {
  return [
    ...expectClose({
      actual: item.title?.height ?? null,
      expected: nativeNoteListMetricContract.titleLineHeight,
      id: `${id}.title`,
      message: 'note row title keeps desktop line height',
    }),
    ...expectClose({
      actual: item.header && item.subtitle ? item.subtitle.y - item.header.y - item.header.height : null,
      expected: nativeNoteListMetricContract.contentGap,
      id: `${id}.subtitle`,
      message: 'note row preview starts after the desktop content gap',
    }),
    ...expectClose({
      actual: item.footer && item.subtitle ? item.footer.y - item.subtitle.y - item.subtitle.height : null,
      expected: nativeNoteListMetricContract.contentGap,
      id: `${id}.footer`,
      message: 'note row chip row starts after the desktop content gap',
    }),
  ]
}

function assertFolderTreeLayout(metrics: NativeLayoutMetricMap): NativeLayoutAssertionFailure[] {
  const tree = folderTreeMetrics(metrics)
  const containers = sidebarFolderContainerMetrics(metrics)

  return [
    ...assertFolderTreeRootLayout(tree, containers.at(-1)),
    ...(hasFixtureFolderStackingMetrics(tree) ? assertFixtureFolderStacking(tree) : []),
  ]
}

function hasFixtureFolderStackingMetrics(tree: FolderTreeMetrics): boolean {
  return Boolean(
    tree.tolaria
      && tree.tolariaMobile
      && tree.tolariaReleases
      && tree.writing
      && tree.writingDrafts
      && tree.writingEssays,
  )
}

function assertFixtureFolderStacking(tree: FolderTreeMetrics): NativeLayoutAssertionFailure[] {
  return [
    ...assertStackedMetricPair({
      current: tree.tolaria,
      currentId: 'sidebar.folder.tolaria',
      previous: tree.writing,
      previousId: 'sidebar.folder.writing',
    }),
    ...assertStackedMetricPair({
      current: tree.writingDrafts,
      currentId: 'sidebar.folder.writing-drafts',
      previous: tree.writingEssays,
      previousId: 'sidebar.folder.writing-essays',
    }),
    ...assertStackedMetricPair({
      current: tree.tolariaReleases,
      currentId: 'sidebar.folder.tolaria-releases',
      previous: tree.tolariaMobile,
      previousId: 'sidebar.folder.tolaria-mobile-ui',
    }),
  ]
}

function sidebarFolderContainerMetrics(metrics: NativeLayoutMetricMap): Array<{ id: string; metric: NativeLayoutMetric }> {
  return Object.entries(metrics)
    .filter(([id]) => id.startsWith(sidebarFolderPrefix) && id.endsWith(sidebarFolderContainerSuffix))
    .map(([id, metric]) => ({
      id: id.slice(0, -sidebarFolderContainerSuffix.length),
      metric,
    }))
}

function folderTreeMetrics(metrics: NativeLayoutMetricMap): FolderTreeMetrics {
  return {
    root: metrics['sidebar.folderTree.root'],
    tolaria: metrics['sidebar.folder.tolaria.container'],
    tolariaMobile: metrics['sidebar.folder.tolaria-mobile-ui.container'],
    tolariaReleases: metrics['sidebar.folder.tolaria-releases.container'],
    writing: metrics['sidebar.folder.writing.container'],
    writingDrafts: metrics['sidebar.folder.writing-drafts.container'],
    writingEssays: metrics['sidebar.folder.writing-essays.container'],
  }
}

function assertFolderTreeRootLayout(
  tree: FolderTreeMetrics,
  lastFolder: { id: string; metric: NativeLayoutMetric } | undefined,
): NativeLayoutAssertionFailure[] {
  const bottomReference = lastFolder?.metric ?? tree.tolaria

  return [
    ...expectMetric({
      id: 'sidebar.folderTree.root',
      message: 'folder tree root is captured before checking native folder spacing',
      metric: tree.root,
    }),
    ...expectClose({
      actual: tree.root?.x ?? null,
      expected: nativeSidebarMetricContract.sectionHorizontalPadding,
      id: 'sidebar.folderTree.root',
      message: 'folder tree keeps desktop section inset',
    }),
    ...expectAtLeast({
      actual: tree.root && bottomReference ? tree.root.height - bottomReference.y - bottomReference.height : null,
      expected: nativeSidebarMetricContract.folderSectionContentPaddingBottom,
      id: 'sidebar.folderTree.root',
      message: 'folder tree keeps desktop bottom padding',
    }),
  ]
}

function assertStackedMetricPair({
  current,
  currentId,
  previous,
  previousId,
}: {
  current: NativeLayoutMetric | undefined
  currentId: string
  previous: NativeLayoutMetric | undefined
  previousId: string
}): NativeLayoutAssertionFailure[] {
  return [
    ...expectMetric({
      id: previousId,
      message: 'previous metric is captured before checking native stacking',
      metric: previous,
    }),
    ...expectMetric({
      id: currentId,
      message: 'metric is captured before checking native stacking',
      metric: current,
    }),
    ...expectAtLeast({
      actual: previous && current ? current.y - previous.y - previous.height : null,
      expected: 0,
      id: currentId,
      message: 'metric starts after the previous metric',
    }),
  ]
}

function assertFolderLayout({
  expectedLeftInset,
  id,
  metrics,
}: {
  expectedLeftInset: number
  id: string
  metrics: NativeLayoutMetricMap
}): NativeLayoutAssertionFailure[] {
  const row = metrics[`${id}.row`]
  const content = metrics[`${id}.content`]
  const label = metrics[`${id}.label`]

  return [
    ...expectMetric({ id, message: 'row is captured before checking native folder layout', metric: row }),
    ...expectMetric({ id, message: 'content is captured before checking native folder layout', metric: content }),
    ...expectMetric({ id, message: 'label is captured before checking native folder text alignment', metric: label }),
    ...expectClose({
      actual: content?.x ?? null,
      expected: expectedLeftInset,
      id,
      message: 'folder content keeps desktop indentation',
    }),
    ...expectClose({
      actual: row?.height ?? null,
      expected: nativeSidebarMetricContract.folderRowHeight,
      id,
      message: 'folder row keeps desktop row height',
    }),
    ...expectClose({
      actual: content?.y ?? null,
      expected: nativeSidebarMetricContract.itemPadding.regular.top,
      id,
      message: 'folder content keeps desktop top padding',
    }),
    ...expectClose({
      actual: content?.height ?? null,
      expected: nativeSidebarMetricContract.folderRowContentHeight,
      id,
      message: 'folder content keeps desktop content height',
    }),
    ...expectClose({
      actual: label?.height ?? null,
      expected: nativeSidebarMetricContract.itemLabelLineHeight,
      id,
      message: 'folder label keeps desktop line height',
    }),
    ...expectClose({
      actual: label?.y ?? null,
      expected: 0,
      id,
      message: 'folder label is vertically centered inside row content',
    }),
  ]
}

function assertCountPillLayouts(metrics: NativeLayoutMetricMap): NativeLayoutAssertionFailure[] {
  return countPillMetricSpecsForMetrics(metrics).flatMap((spec) => assertCountPillLayout(metrics, spec))
}

function countPillMetricSpecsForMetrics(metrics: NativeLayoutMetricMap): CountPillLayout[] {
  const ids = [...countPillIds(metrics)]
  if (ids.length === 0) return countPillMetricSpecs

  return ids.map((id) => ({
    compact: id.startsWith('sidebar.section.'),
    id,
  }))
}

function countPillIds(metrics: NativeLayoutMetricMap): Set<string> {
  return new Set(Object.keys(metrics)
    .filter((id) => id.endsWith(sidebarCountContainerSuffix))
    .map((id) => id.slice(0, -'.container'.length)))
}

function assertCountPillLayout(
  metrics: NativeLayoutMetricMap,
  { compact = false, id }: CountPillLayout,
): NativeLayoutAssertionFailure[] {
  const container = metrics[`${id}.container`]
  const text = metrics[`${id}.text`]
  const expectedHeight = compact
    ? nativeSidebarMetricContract.countPill.compactHeight
    : nativeSidebarMetricContract.countPill.height

  return [
    ...expectMetric({ id, message: 'count pill container is captured before checking native alignment', metric: container }),
    ...expectMetric({ id, message: 'count pill text is captured before checking native alignment', metric: text }),
    ...expectClose({
      actual: container?.height ?? null,
      expected: expectedHeight,
      id,
      message: 'count pill keeps desktop height',
    }),
    ...expectClose({
      actual: text ? text.y + text.height / 2 : null,
      expected: expectedHeight / 2,
      id,
      message: 'count text is vertically centered inside native pill',
    }),
  ]
}

function expectMetric(expectation: MetricExpectation): NativeLayoutAssertionFailure[] {
  const { id, message, metric } = expectation
  if (metric) return []

  return [{ actual: null, expected: 1, id, message }]
}

function expectClose(expectation: LayoutExpectation): NativeLayoutAssertionFailure[] {
  const { actual, expected, id, message } = expectation
  if (actual !== null && Math.abs(actual - expected) <= layoutTolerance) return []

  return [{ actual, expected, id, message }]
}

function expectAtLeast(expectation: LayoutExpectation): NativeLayoutAssertionFailure[] {
  const { actual, expected, id, message } = expectation
  if (actual !== null && actual >= expected) return []

  return [{ actual, expected, id, message }]
}

function expectAtMost(expectation: LayoutExpectation): NativeLayoutAssertionFailure[] {
  const { actual, expected, id, message } = expectation
  if (actual !== null && actual <= expected) return []

  return [{ actual, expected, id, message }]
}

function parseMetric(rawJson: string): NativeLayoutMetric | null {
  try {
    const value: unknown = JSON.parse(rawJson)
    return nativeLayoutMetricFromJson(value)
  } catch {
    return null
  }
}

function nativeLayoutMetricFromJson(value: unknown): NativeLayoutMetric | null {
  if (!isRecord(value)) return null

  const id = stringValue(value.id)
  const platform = stringValue(value.platform)
  const height = numberValue(value.height)
  const width = numberValue(value.width)
  const x = numberValue(value.x)
  const y = numberValue(value.y)
  if (!id || !platform || height === null || width === null || x === null || y === null) return null

  return { height, id, platform, width, x, y }
}

function stringValue(value: unknown): string | null {
  return typeof value === 'string' ? value : null
}

function numberValue(value: unknown): number | null {
  return typeof value === 'number' ? value : null
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}
