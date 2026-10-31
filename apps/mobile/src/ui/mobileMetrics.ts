import {
  desktopEditorParity, desktopNoteItemParity, desktopPanelParity,
  desktopPropertyParity, desktopRelationshipParity, desktopSidebarParity,
  desktopStatusBarParity, desktopToolbarActionParity, desktopToolbarParity,
} from './desktopParity'
import { mobileSpace, mobileType } from './tokens'

type MetricValue = number | string | { readonly [key: string]: MetricValue }
type ScaledMetrics<T> = { [Key in keyof T]: T[Key] extends number ? number : T[Key] extends string ? T[Key] : ScaledMetrics<T[Key]> }

const preserved = new Set(['borderLeftWidth', 'horizontalRuleThickness', 'pressedOpacity', 'sectionTitleLetterSpacing', 'contentMaxWidth'])

function scaleMetricValue(value: MetricValue, factor: number, key: string): MetricValue {
  if (typeof value === 'string') return value
  if (typeof value === 'number') return preserved.has(key) || key.toLowerCase().includes('radius') ? value : Math.round(value * factor * 10) / 10
  return scaleMetrics(value, factor)
}

function scaleMetrics<T extends Record<string, MetricValue>>(source: T, factor: number): ScaledMetrics<T> {
  return Object.fromEntries(Object.entries(source).map(([key, value]) => [key, scaleMetricValue(value, factor, key)])) as ScaledMetrics<T>
}

function createMetrics(factor: number) {
  const size = (points: number) => Math.round(points * factor * 10) / 10
  return {
    factor, size,
    sidebar: scaleMetrics(desktopSidebarParity, factor),
    noteItem: scaleMetrics(desktopNoteItemParity, factor),
    property: scaleMetrics(desktopPropertyParity, factor),
    relationship: scaleMetrics(desktopRelationshipParity, factor),
    editor: scaleMetrics(desktopEditorParity, factor),
    panel: { ...desktopPanelParity, toolbarHeight: size(desktopPanelParity.toolbarHeight) },
    toolbar: scaleMetrics(desktopToolbarParity, factor),
    toolbarAction: scaleMetrics(desktopToolbarActionParity, factor),
    statusBar: scaleMetrics(desktopStatusBarParity, factor),
    phoneChrome: {
      noteRowMinHeight: 44,
      noteRowPaddingVertical: 8,
      noteSnippetLineHeight: 20,
      noteSnippetMarginTop: 4,
      noteSnippetTextSize: 15,
      noteTitleLineHeight: 22,
      noteTitleTextSize: 17,
      rowHorizontalPadding: 16,
      sidebarRowHeight: 44,
      sidebarTextLineHeight: 22,
      sidebarTextSize: 17,
      countTextSize: 17,
      folderIconSize: 20,
      folderRowHeight: 44,
      folderTextLineHeight: 22,
      folderTextSize: 17,
    },
    space: scaleMetrics(mobileSpace, factor),
    type: scaleMetrics(mobileType, factor),
  }
}

export const mobileMetrics = { 1: createMetrics(1), 1.2: createMetrics(1.2) }
export type MobileMetrics = ReturnType<typeof createMetrics>

export function isPhoneViewport(width: number, isPad = false) {
  return width < 600 && !isPad
}

export function phoneViewportStyle<T>(isPhone: boolean, style: T): T | null {
  return isPhone ? style : null
}
