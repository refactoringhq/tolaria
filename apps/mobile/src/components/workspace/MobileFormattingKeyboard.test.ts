// @vitest-environment jsdom
import { act, type CSSProperties, createElement, type ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { MobileCompactFormattingToolbar } from './MobileCompactFormattingToolbar'
import { MobileMarkdownFormattingToolbar } from './MobileMarkdownFormattingToolbar'

const keyboard = vi.hoisted(() => ({ visible: false, bottom: 34, phone: true,
  listeners: new Map<string, Set<() => void>>(), dismiss: vi.fn() }))
type SurfaceProps = { children?: ReactNode; style?: CSSProperties | CSSProperties[]; contentContainerStyle?: CSSProperties[]; testID?: string }
function Surface({ children, style, contentContainerStyle, testID }: SurfaceProps) {
  return createElement('div', { style: Object.assign({}, ...[style, contentContainerStyle].flat()), 'data-testid': testID }, children)
}
function Control({ children, testID, onPress, style }: SurfaceProps & { onPress?: () => void }) {
  return createElement('button', { type: 'button', onClick: onPress, style: Object.assign({}, ...[style].flat()), 'data-testid': testID }, children)
}
function WebTrigger({ children, testID, style }: SurfaceProps) {
  return createElement('button', { type: 'button', style: style as CSSProperties, 'data-testid': testID }, children)
}
vi.mock('react-native', () => ({ View: Surface, ScrollView: Surface,
  Platform: { OS: 'ios' },
  StyleSheet: { create: (value: object) => value, flatten: (value: CSSProperties[]) => Object.assign({}, ...value) }, Keyboard: {
    isVisible: () => keyboard.visible, dismiss: keyboard.dismiss,
    scheduleLayoutAnimation: vi.fn(),
    addListener: (event: string, callback: () => void) => {
      const listeners = keyboard.listeners.get(event) ?? new Set()
      listeners.add(callback)
      keyboard.listeners.set(event, listeners)
      return { remove: () => listeners.delete(callback) }
    },
  } }))
vi.mock('react-native-gesture-handler', () => ({ ScrollView: Surface }))
vi.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ bottom: keyboard.bottom }) }))
vi.mock('../../ui/useMobileDeviceLayout', () => ({ useMobileDeviceLayout: () => keyboard.phone ? 'phone' : 'tablet' }))
vi.mock('../../ui/theme/useMobileTheme', async () => {
  const { mobileMetrics } = await import('../../ui/mobileMetrics')
  const { mobilePalettes } = await import('../../ui/theme/mobilePalette')
  return { useMobileStyles: (factory: (colors: object, metrics: object) => object) => factory(mobilePalettes.light, mobileMetrics[1.2]) }
})
vi.mock('../ui/button', () => ({ Button: Control }))
vi.mock('../ui/text', () => ({ Text: ({ children }: SurfaceProps) => createElement('span', null, children) }))
vi.mock('../ui/dropdown-menu', () => ({ DropdownMenu: Surface, DropdownMenuTrigger: WebTrigger, DropdownMenuContent: Surface, DropdownMenuItem: Control }))
vi.mock('phosphor-react-native', () => ({ Check: () => null, DotsThree: () => null, ListBullets: () => null,
  Plus: () => null, Table: () => null, TextH: () => null, Keyboard: () => null, CaretDown: () => null }))
vi.mock('./mobileFormattingCommands', () => ({ formattingCommands: [
  { action: 'bold', label: 'Bold', testID: 'editor-format-bold', icon: () => null },
  { action: 'heading2', label: 'Heading 2', testID: 'editor-format-heading-2', icon: () => null },
  { action: 'wikilink', label: 'Insert wikilink', testID: 'editor-format-wikilink', icon: () => null },
  { action: 'strike', label: 'Strikethrough', testID: 'editor-format-strike', icon: () => null },
] }))

const roots: ReturnType<typeof createRoot>[] = []
beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  keyboard.visible = false
  keyboard.bottom = 34
  keyboard.phone = true
  keyboard.listeners.clear()
  keyboard.dismiss.mockReset()
})
afterEach(async () => {
  for (const root of roots.splice(0)) await act(async () => root.unmount())
  expect([...keyboard.listeners.values()].every(listeners => listeners.size === 0)).toBe(true)
  vi.unstubAllGlobals()
})

it.each([0, 34])('shows a fixed 44-point dismiss control only while the keyboard is visible (inset %s)', async bottom => {
  keyboard.bottom = bottom
  const host = await mount(createElement(MobileCompactFormattingToolbar, { actions: ['bold'], selected: [], inTable: false, onFormat: vi.fn() }))
  expect(host.querySelector('[data-testid="editor-hide-keyboard-action"]')).toBeNull()
  await keyboardEvent('keyboardWillShow')
  const button = host.querySelector<HTMLButtonElement>('[data-testid="editor-hide-keyboard-action"]')
  expect(button?.style.width).toBe('44px')
  expect(button?.style.height).toBe('44px')
  await act(async () => button?.click())
  expect(keyboard.dismiss).toHaveBeenCalledExactlyOnceWith()
  await keyboardEvent('keyboardWillHide')
  expect(host.querySelector('[data-testid="editor-hide-keyboard-action"]')).toBeNull()
})

it('uses the editor-owned blur callback for rich text instead of native text-input dismissal', async () => {
  keyboard.visible = true
  const blur = vi.fn()
  const host = await mount(createElement(MobileCompactFormattingToolbar, { actions: ['bold'], selected: [], inTable: false,
    onFormat: vi.fn(), onDismissKeyboard: blur }))
  await act(async () => host.querySelector<HTMLButtonElement>('[data-testid="editor-hide-keyboard-action"]')?.click())
  expect(blur).toHaveBeenCalledExactlyOnceWith()
  expect(keyboard.dismiss).not.toHaveBeenCalled()
})

it('reuses compact groups in the phone source editor with one keyboard-state subscription', async () => {
  keyboard.visible = true
  const format = vi.fn()
  const host = await mount(createElement(MobileMarkdownFormattingToolbar, { onFormat: format }))
  const headings = host.querySelector<HTMLButtonElement>('[data-testid="editor-format-menu-headings"]')
  expect(headings?.style.width).toBe('44px')
  expect(headings?.style.height).toBe('44px')
  expect(host.querySelector('[data-testid="editor-hide-keyboard-action"]')).not.toBeNull()
  expect([...keyboard.listeners.values()].reduce((count, listeners) => count + listeners.size, 0)).toBe(2)
  await act(async () => host.querySelector<HTMLButtonElement>('[data-testid="editor-format-heading-2"]')?.click())
  expect(format).toHaveBeenCalledExactlyOnceWith('heading2')
})

it('keeps the full tablet strip and does not add phone-only keyboard chrome', async () => {
  keyboard.visible = true
  keyboard.phone = false
  const host = await mount(createElement(MobileMarkdownFormattingToolbar, { onFormat: vi.fn() }))
  expect(host.querySelector('[data-testid="editor-format-menu-headings"]')).toBeNull()
  expect(host.querySelector('[data-testid="editor-format-heading-2"]')).not.toBeNull()
  expect(host.querySelector('[data-testid="editor-hide-keyboard-action"]')).toBeNull()
  expect(host.querySelector('[data-testid="editor-format-wikilink"]')).not.toBeNull()
  expect(host.querySelector('[data-testid="editor-formatting-fixed-actions"]')).toBeNull()
})

it('pins insert, more and dismiss outside the scrolling phone actions in that order', async () => {
  keyboard.visible = true
  const format = vi.fn()
  const host = await mount(createElement(MobileMarkdownFormattingToolbar, { onFormat: format }))
  const fixed = requiredElement(host, 'editor-formatting-fixed-actions')
  const scroller = requiredElement(host, 'editor-formatting-actions')
  expect(fixed.style.flexShrink).toBe('0')
  const controls = [...fixed.querySelectorAll<HTMLButtonElement>('button[data-testid^="editor-format-menu-"], button[data-testid="editor-hide-keyboard-action"]')]
  expect(controls.map(button => button.dataset.testid)).toEqual([
    'editor-format-menu-insert', 'editor-format-menu-more', 'editor-hide-keyboard-action',
  ])
  expect(controls.every(button => !scroller.contains(button))).toBe(true)
  const insert = requiredElement(fixed, 'editor-format-options-insert')
  await act(async () => requiredElement(insert, 'editor-format-wikilink').click())
  expect(format).toHaveBeenCalledExactlyOnceWith('wikilink')
  await act(async () => requiredElement(fixed, 'editor-format-strike').click())
  expect(format).toHaveBeenLastCalledWith('strike')
})

function requiredElement(host: ParentNode, id: string) {
  const element = host.querySelector<HTMLElement>(`[data-testid="${id}"]`)
  if (!element) throw new Error(`Missing toolbar element: ${id}`)
  return element
}

async function mount(children: ReactNode) {
  const host = document.createElement('div')
  const root = createRoot(host)
  roots.push(root)
  await act(async () => root.render(children))
  return host
}

function keyboardEvent(name: string) {
  return act(async () => { for (const listener of keyboard.listeners.get(name) ?? []) listener() })
}
