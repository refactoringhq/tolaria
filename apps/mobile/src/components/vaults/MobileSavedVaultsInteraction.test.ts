// @vitest-environment jsdom
import { act, type ComponentProps, createElement, type ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { MobileSavedVaults } from './MobileSavedVaults'

const nativeAlert = vi.hoisted(() => ({ alert: vi.fn() }))
const analytics = vi.hoisted(() => ({ capture: vi.fn() }))

type Props = { children?: ReactNode; testID?: string; label?: string; onPress?: () => void; disabled?: boolean }
function Surface(props: Props) {
  return createElement('div', { 'data-testid': props.testID }, props.children)
}
function Control(props: Props) {
  return createElement('button', { type: 'button', 'data-testid': props.testID,
    onClick: props.onPress, disabled: props.disabled }, props.label)
}
function TextField(props: { testID?: string; value?: string; onChangeText?: (value: string) => void; onEndEditing?: (event: { nativeEvent: { text: string } }) => void }) {
  return createElement('input', { 'data-testid': props.testID, value: props.value,
    onChange: (event: Event) => props.onChangeText?.((event.target as HTMLInputElement).value),
    onBlur: (event: Event) => props.onEndEditing?.({ nativeEvent: { text: (event.target as HTMLInputElement).value } }) })
}
vi.mock('react-native', () => ({ Alert: { alert: nativeAlert.alert }, View: Surface, StyleSheet: { create: (styles: object) => styles } }))
vi.mock('phosphor-react-native', () => ({ FolderOpen: () => null, GithubLogo: () => null, X: () => null }))
vi.mock('../../ui/theme/useMobileTheme', () => ({ useMobileStyles: () => ({}), useMobileColors: () => ({}) }))
vi.mock('../../workspace/nativeWorkspaceAccess', () => ({ optionalNativeWorkspaceAccessModule: () => null }))
vi.mock('../../ui/MobileButton', () => ({ MobileButton: Control }))
vi.mock('../../ui/MobileIconButton', () => ({ MobileIconButton: Control }))
vi.mock('../../ui/MobileTextInput', () => ({ MobileTextInput: TextField }))
vi.mock('../../analytics/useMobileAnalytics', () => ({ useMobileAnalytics: () => analytics }))
vi.mock('../ui/mobileNativeDialogs', () => ({ showNativeConfirmation: (options: { cancelLabel: string; confirmLabel: string; message: string; onConfirm: () => void; title: string }) => {
  nativeAlert.alert(options.title, options.message, [
    { text: options.cancelLabel, style: 'cancel' },
    { text: options.confirmLabel, style: 'destructive', onPress: options.onConfirm },
  ])
} }))
vi.mock('../ui/text', () => ({ Text: Surface }))

let root: ReturnType<typeof createRoot>
let host: HTMLDivElement
beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  host = document.createElement('div')
  root = createRoot(host)
})
afterEach(async () => { await act(async () => root.unmount()); vi.unstubAllGlobals() })
beforeEach(() => { nativeAlert.alert.mockReset(); analytics.capture.mockReset() })

it.each([false, true])('keeps Open local folder inside Available Vaults, including an empty catalog (busy=%s)', async busy => {
  const openFolder = vi.fn(async () => undefined)
  const manager: ComponentProps<typeof MobileSavedVaults>['manager'] = { busy, openFolder,
    catalog: { localVaults: [], vaults: [], updateAlias: vi.fn(async () => 'laputa') }, active: { selection: null, git: null },
    select: vi.fn(async () => undefined), selectLocal: vi.fn(async () => undefined), forget: vi.fn(async () => undefined) }
  await act(async () => root.render(createElement(MobileSavedVaults, { manager })))
  const section = host.querySelector('[data-testid="saved-vaults"]')
  expect(section?.textContent).toContain('Available vaults')
  const action = section?.querySelector<HTMLButtonElement>('[data-testid="open-local-vault"]')
  expect(action).not.toBeNull()
  expect(action?.disabled).toBe(busy)
  await act(async () => action?.click())
  expect(openFolder).toHaveBeenCalledTimes(busy ? 0 : 1)
})

it('removes a saved vault only from the native destructive confirmation', async () => {
  const forget = vi.fn(async () => undefined)
  const manager: ComponentProps<typeof MobileSavedVaults>['manager'] = { busy: false,
    openFolder: vi.fn(async () => undefined), catalog: { localVaults: [{ id: 'local', label: 'Local', directory: '/vault' }], vaults: [], updateAlias: vi.fn(async () => 'local') },
    active: { selection: null, git: null }, select: vi.fn(async () => undefined), selectLocal: vi.fn(async () => undefined), forget }
  await act(async () => root.render(createElement(MobileSavedVaults, { manager })))
  await act(async () => host.querySelector<HTMLButtonElement>('[data-testid="forget-vault-local"]')?.click())
  expect(forget).not.toHaveBeenCalled()
  const buttons = nativeAlert.alert.mock.calls[0]?.[2]
  expect(buttons?.[1]?.style).toBe('destructive')
  await act(async () => buttons?.[1]?.onPress?.())
  expect(forget).toHaveBeenCalledWith('local')
})

it('saves the edited slug without sending it to analytics', async () => {
  const updateAlias = vi.fn(async () => 'laputa')
  const manager: ComponentProps<typeof MobileSavedVaults>['manager'] = { busy: false, openFolder: vi.fn(),
    catalog: { localVaults: [], vaults: [{ id: 'stable-id', label: 'Personal Vault', repositoryUrl: 'https://github.com/example/vault' }], updateAlias },
    active: { selection: null, git: null }, select: vi.fn(async () => undefined), selectLocal: vi.fn(async () => undefined),
    forget: vi.fn(async () => undefined) }
  await act(async () => root.render(createElement(MobileSavedVaults, { manager })))
  const input = host.querySelector<HTMLInputElement>('[data-testid="vault-slug-stable-id"]')
  if (!input) throw new Error('Vault slug input was not rendered')
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(input, 'Laputa')
    input.dispatchEvent(new Event('change', { bubbles: true }))
    input.dispatchEvent(new FocusEvent('focusout', { bubbles: true }))
  })
  expect(updateAlias).toHaveBeenCalledWith('stable-id', 'Laputa')
  expect(analytics.capture).toHaveBeenCalledWith({ name: 'mobile_setting_changed', setting: 'vaultSlug' })
  expect(JSON.stringify(analytics.capture.mock.calls)).not.toContain('Laputa')
})
