// @vitest-environment jsdom
import { act, createElement, type ComponentProps, type ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { MobileSavedVaults } from './MobileSavedVaults'

type Props = { children?: ReactNode; testID?: string; label?: string; onPress?: () => void; disabled?: boolean }
function Surface(props: Props) {
  return createElement('div', { 'data-testid': props.testID }, props.children)
}
function Control(props: Props) {
  return createElement('button', { type: 'button', 'data-testid': props.testID,
    onClick: props.onPress, disabled: props.disabled }, props.label)
}
vi.mock('react-native', () => ({ View: Surface, StyleSheet: { create: (styles: object) => styles } }))
vi.mock('phosphor-react-native', () => ({ FolderOpen: () => null, GithubLogo: () => null, X: () => null }))
vi.mock('../../ui/theme/useMobileTheme', () => ({ useMobileStyles: () => ({}), useMobileColors: () => ({}) }))
vi.mock('../../workspace/nativeWorkspaceAccess', () => ({ optionalNativeWorkspaceAccessModule: () => null }))
vi.mock('../../ui/MobileButton', () => ({ MobileButton: Control }))
vi.mock('../../ui/MobileIconButton', () => ({ MobileIconButton: Control }))
vi.mock('../ui/text', () => ({ Text: Surface }))

let root: ReturnType<typeof createRoot>
let host: HTMLDivElement
beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  host = document.createElement('div')
  root = createRoot(host)
})
afterEach(async () => { await act(async () => root.unmount()); vi.unstubAllGlobals() })

it.each([false, true])('keeps Open local folder inside Available Vaults, including an empty catalog (busy=%s)', async busy => {
  const openFolder = vi.fn(async () => undefined)
  const manager: ComponentProps<typeof MobileSavedVaults>['manager'] = { busy, openFolder,
    catalog: { localVaults: [], vaults: [] }, active: { selection: null, git: null },
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
