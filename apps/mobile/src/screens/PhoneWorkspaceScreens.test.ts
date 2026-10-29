// @vitest-environment jsdom
import { act, createElement, type ReactNode, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { PhoneWorkspaceScreens } from './PhoneWorkspaceScreens'
import { createPhoneWorkspaceScreenProps } from './PhoneWorkspaceScreens.testSupport'

const calls = vi.hoisted(() => ({ sidebar: vi.fn(), list: vi.fn(), properties: vi.fn(), editor: vi.fn() }))
vi.mock('react-native', () => ({
  View: ({ children, testID }: { children?: ReactNode; testID?: string }) =>
    createElement('div', { 'data-testid': testID }, children),
  StyleSheet: { create: (styles: object) => styles, hairlineWidth: 1 },
}))
vi.mock('phosphor-react-native', () => ({ List: () => null }))
vi.mock('../components/workspace/MobileNoteListPanel', () => ({ MobileNoteListPanel: (props: Record<string, unknown>) => {
  calls.list(props)
  return createElement('div', { 'data-testid': 'phone-test-note-list' }, props.leading as ReactNode)
} }))
vi.mock('../ui/MobileIconButton', () => ({
  MobileIconButton: ({
    accessibilityLabel,
    children,
    onPress,
    testID,
  }: {
    accessibilityLabel: string
    children?: ReactNode
    onPress?: () => void
    testID?: string
  }) => createElement('button', {
    'aria-label': accessibilityLabel,
    'data-testid': testID,
    onClick: onPress,
    type: 'button',
  }, children),
}))
vi.mock('../components/workspace/MobilePropertiesPanel', () => ({ MobilePropertiesPanel: () => {
  calls.properties()
  return null
} }))
vi.mock('../components/workspace/MobileWorkspaceSidebar', () => ({ MobileWorkspaceSidebar: (props: { onOpenCommandPalette?: () => void }) => {
  calls.sidebar(props)
  return createElement('button', { type: 'button', 'data-testid': 'sidebar-command-palette-action', onClick: props.onOpenCommandPalette })
} }))
vi.mock('../ui/theme/useMobileTheme', () => ({ useMobileStyles: () => ({
  mobileColors: { textMuted: '#777' },
  styles: { screen: {}, drawerRoot: {}, drawerPanel: {} },
}) }))
vi.mock('../workspace/mobileWorkspaceEmptyState', () => ({ mobileWorkspaceHasNoVault: () => false }))
vi.mock('./usePhoneViewportWidth', () => ({ usePhoneViewportWidth: () => 390 }))
vi.mock('./PhoneScreenLayer', () => ({ PhoneScreenLayer: ({
  active,
  children,
  testID,
}: {
  active: boolean
  children?: ReactNode
  testID: string
}) => createElement('div', { 'data-active': String(active), 'data-testid': testID }, children) }))
vi.mock('./PhoneWorkspaceChrome', () => ({
  PhoneBackButton: () => null,
  PhoneTopBar: ({ children }: { children?: ReactNode }) => createElement('header', null, children),
}))
vi.mock('./TabletEditorPanel', () => ({ TabletEditorPanel: (props: Record<string, unknown>) => {
  calls.editor(props)
  return null
} }))
vi.mock('./useMobileInspectorReferenceGroups', () => ({ useMobileInspectorReferenceGroups: () => [] }))

let root: ReturnType<typeof createRoot>
let host: HTMLDivElement
const openCommandPalette = vi.fn()

beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  vi.clearAllMocks()
  host = document.createElement('div')
  root = createRoot(host)
})

afterEach(async () => {
  await act(async () => root.unmount())
  vi.unstubAllGlobals()
})

it('keeps command palette access in the sidebar and removes it from phone headers', async () => {
  await act(async () => root.render(createElement(PhoneWorkspaceScreens, createPhoneWorkspaceScreenProps(openCommandPalette))))

  expect(host.querySelector('[data-testid="sidebar-command-palette-action"]')).not.toBeNull()
  expect(calls.sidebar.mock.lastCall?.[0].onOpenCommandPalette).toBe(openCommandPalette)
  await act(async () => host.querySelector<HTMLButtonElement>('[data-testid="sidebar-command-palette-action"]')?.click())
  expect(openCommandPalette).toHaveBeenCalledOnce()
  expect(calls.list.mock.lastCall?.[0].leading).toBeDefined()
  expect(calls.editor.mock.lastCall?.[0].trailing).toBeUndefined()
  expect(calls.properties).toHaveBeenCalledOnce()
  expect(host.querySelectorAll('[aria-label="Command palette"]')).toHaveLength(0)
})

it('opens the sidebar from the phone note-list header', async () => {
  const props = createPhoneWorkspaceScreenProps(openCommandPalette)
  function ControlledPhoneWorkspace() {
    const [phoneState, setPhoneState] = useState(props.phoneState)
    return createElement(PhoneWorkspaceScreens, {
      ...props,
      phoneState,
      openSidebar: () => setPhoneState('sidebar'),
    })
  }

  await act(async () => root.render(createElement(ControlledPhoneWorkspace)))

  const button = host.querySelector<HTMLButtonElement>('[data-testid="phone-note-list-sidebar-button"]')
  expect(button?.getAttribute('aria-label')).toBe('Show sidebar')
  await act(async () => button?.click())
  expect(host.querySelector('[data-testid="phone-sidebar-slot"]')?.getAttribute('data-active')).toBe('true')
  expect(host.querySelector('[data-testid="phone-list-slot"]')?.getAttribute('data-active')).toBe('false')
})
