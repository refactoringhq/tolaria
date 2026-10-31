// @vitest-environment jsdom
import { act, createElement, useLayoutEffect, type CSSProperties, type ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { mobileMetrics } from '../../ui/mobileMetrics'
import { mobilePalettes } from '../../ui/theme/mobilePalette'
import { MobileWorkspaceSidebar } from './MobileWorkspaceSidebar'
import type { MobileSidebarSection } from '../../workspace/mobileWorkspaceModel'

type Props = { children?: ReactNode; testID?: string; style?: CSSProperties | CSSProperties[];
  contentContainerStyle?: CSSProperties[]; onPress?: () => void; accessibilityLabel?: string;
  accessibilityState?: { expanded?: boolean }; onLayout?: (event: { nativeEvent: { layout: { height: number } } }) => void }
function Surface(props: Props) {
  const { onLayout, testID } = props
  useLayoutEffect(() => {
    if (testID === 'sidebar-floating-controls') onLayout?.({ nativeEvent: { layout: { height: 96 } } })
  }, [onLayout, testID])
  return createElement(props.onPress ? 'button' : 'div', {
    'data-testid': props.testID, onClick: props.onPress, 'aria-label': props.accessibilityLabel,
    'aria-expanded': props.accessibilityState?.expanded,
    style: Object.assign({}, ...[props.style, props.contentContainerStyle].flat(2)),
  }, props.children)
}
vi.mock('react-native', () => ({ View: Surface, Text: Surface, Pressable: Surface, ScrollView: Surface,
  Platform: { OS: 'web' }, StyleSheet: { create: (value: object) => value, hairlineWidth: 1 },
  useWindowDimensions: () => ({ fontScale: 1 }) }))
vi.mock('../../ui/theme/useMobileTheme', () => ({ useMobileStyles: (factory: typeof import('./mobileSidebarStyles').createSidebarStyles) => factory(mobilePalettes.light, mobileMetrics[1.2]) }))
vi.mock('../../ui/MobilePanel', () => ({ MobilePanel: Surface, MobileToolbar: Surface }))
vi.mock('../../ui/MobileIconButton', () => ({ MobileIconButton: Surface }))
vi.mock('../ui/text', () => ({ Text: Surface }))
vi.mock('./MobileSidebarSettings', () => ({ MobileSidebarSettings: () => createElement(Surface, { testID: 'sidebar-settings' }) }))
vi.mock('../vaults/MobileVaultPicker', () => ({ MobileVaultPicker: () => null }))
vi.mock('./MobileSidebarCountPill', () => ({ MobileSidebarCountPill: () => null }))
vi.mock('./MobileWorkspaceIconResolver', () => ({ mobilePhosphorIconElement: () => null }))
vi.mock('./MobileWorkspaceSidebarFolderTree', () => ({ FolderTree: () => createElement(Surface, { testID: 'owned-folder-tree' }) }))
vi.mock('phosphor-react-native', () => ({ CaretDown: () => null, CaretRight: () => null, FileText: () => null, Eye: () => null, Plus: () => null }))

const select = vi.fn(), create = vi.fn(), visibility = vi.fn()
const sections: MobileSidebarSection[] = [
  { id: 'primary', items: [{ id: 'inbox', icon: 'Inbox', label: 'Inbox' }] },
  ...['views', 'favorites', 'types', 'folders'].map(id => ({ id, label: id,
    items: [{ id: `owned-${id}`, icon: 'FileText', label: `Owned ${id}`, active: true }],
    ...(id === 'folders' ? { folders: [] } : {}),
  })),
]
let root: ReturnType<typeof createRoot>
let host: HTMLDivElement
beforeEach(async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  vi.clearAllMocks()
  host = document.createElement('div')
  root = createRoot(host)
  await act(async () => root.render(createElement(MobileWorkspaceSidebar, {
    sections, onSelectItem: select, onCreateType: create, onOpenTypeVisibility: visibility,
  })))
})
afterEach(async () => { await act(async () => root.unmount()); vi.unstubAllGlobals() })

it.each(['views', 'favorites', 'types', 'folders'])('toggles the whole %s header without selecting a note', async id => {
  const toggle = element(`sidebar-section-toggle-${id}`)
  expect(toggle.getAttribute('aria-expanded')).toBe('true')
  await act(async () => toggle.click())
  expect(host.querySelector(`[data-testid="sidebar-item-owned-${id}"]`)).toBeNull()
  expect(toggle.getAttribute('aria-expanded')).toBe('false')
  expect(element('sidebar-item-inbox')).toBeTruthy()
  await act(async () => toggle.click())
  expect(element(`sidebar-item-owned-${id}`)).toBeTruthy()
  expect(select).not.toHaveBeenCalled()
})

it('keeps add and visibility buttons independent of the collapsed header', async () => {
  await act(async () => element('sidebar-section-toggle-types').click())
  await act(async () => element('sidebar-section-create-types').click())
  await act(async () => element('sidebar-section-visibility-types').click())
  expect(create).toHaveBeenCalledOnce()
  expect(visibility).toHaveBeenCalledOnce()
  expect(element('sidebar-section-toggle-types').getAttribute('aria-expanded')).toBe('false')
  expect(element('sidebar-section-create-types').closest('[data-testid="sidebar-section-toggle-types"]')).toBeNull()
})

it('floats controls without a background strip and reserves their measured scroll clearance', () => {
  const overlay = element('sidebar-floating-controls')
  expect(overlay.style.position).toBe('absolute')
  expect(overlay.style.bottom).toBe('0px')
  expect(overlay.style.backgroundColor).toBe('')
  expect(element('sidebar-scroll').style.paddingBottom).toBe('96px')
})

function element(id: string) {
  const result = host.querySelector<HTMLElement>(`[data-testid="${id}"]`)
  expect(result, id).not.toBeNull()
  if (!result) throw new Error(`Missing ${id}`)
  return result
}
