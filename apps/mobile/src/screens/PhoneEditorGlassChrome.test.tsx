// @vitest-environment jsdom
import { act, createElement, type ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { PhoneEditorGlassChrome } from './PhoneEditorGlassChrome'

const harness = vi.hoisted(() => ({
  actions: [] as Array<{ id: string; title: string }>,
  confirmation: undefined as undefined | (() => void),
  dismiss: vi.fn(),
}))

vi.mock('react-native', () => ({
  Animated: {
    Value: class {},
    View: ({ children }: { children?: ReactNode }) => createElement('div', null, children),
    timing: () => ({ start: () => undefined }),
  },
  Keyboard: {
    addListener: () => ({ remove: vi.fn() }),
    dismiss: harness.dismiss,
  },
  Pressable: ({
    accessibilityLabel,
    children,
    onPress,
    testID,
  }: {
    accessibilityLabel?: string
    children?: ReactNode
    onPress?: () => void
    testID?: string
  }) =>
    createElement(
      'button',
      {
        'aria-label': accessibilityLabel,
        'data-testid': testID,
        onClick: onPress,
        type: 'button',
      },
      children,
    ),
  StyleSheet: { absoluteFill: {}, create: (styles: object) => styles },
  useWindowDimensions: () => ({ width: 390, height: 844 }),
  View: ({ children, testID }: { children?: ReactNode; testID?: string }) => createElement('div', { 'data-testid': testID }, children),
}))
vi.mock('react-native-svg', () => ({
  default: ({ children }: { children?: ReactNode }) => createElement('svg', null, children),
  Defs: ({ children }: { children?: ReactNode }) => createElement('defs', null, children),
  LinearGradient: ({ children }: { children?: ReactNode }) => createElement('linearGradient', null, children),
  Rect: () => createElement('rect'),
  Stop: () => createElement('stop'),
}))
vi.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 47 }),
}))
vi.mock('@expo/ui/community/menu', () => ({
  default: ({
    actions,
    children,
    onPressAction,
  }: {
    actions: Array<{ id: string; title: string }>
    children?: ReactNode
    onPressAction: (event: { nativeEvent: { event: string } }) => void
  }) => {
    harness.actions = actions
    return createElement(
      'div',
      null,
      children,
      createElement('button', {
        'data-testid': 'invoke-menu-favorite',
        onClick: () => onPressAction({ nativeEvent: { event: 'favorite' } }),
        type: 'button',
      }),
      ...actions.map(({ id }) =>
        createElement('button', {
          'data-testid': `menu-${id}`,
          key: id,
          onClick: () => onPressAction({ nativeEvent: { event: id } }),
          type: 'button',
        }),
      ),
    )
  },
}))
vi.mock('expo-glass-effect', () => ({
  GlassView: ({ children }: { children?: ReactNode }) => createElement('div', null, children),
}))
vi.mock('expo-symbols', () => ({ SymbolView: () => null }))
vi.mock('../components/ui/mobileNativeDialogs', () => ({
  showNativeConfirmation: ({ onConfirm }: { onConfirm: () => void }) => {
    harness.confirmation = onConfirm
  },
}))
vi.mock('../components/ui/text', () => ({
  Text: ({ children }: { children?: ReactNode }) => createElement('span', null, children),
}))
vi.mock('../i18n/mobileText', () => ({ mobileText: (key: string) => key }))
vi.mock('../ui/theme/useMobileTheme', () => ({
  useMobileColors: () => ({ editor: '#fff', text: '#111' }),
  useMobileMetrics: () => ({ phoneChrome: { rowHorizontalPadding: 12 }, space: { sm: 8 } }),
}))

let host: HTMLDivElement
let root: ReturnType<typeof createRoot>
const callbacks = {
  back: vi.fn(),
  delete: vi.fn(),
  pdf: vi.fn(),
  find: vi.fn(),
  move: vi.fn(),
  properties: vi.fn(),
  rename: vi.fn(),
  favorite: vi.fn(),
  source: vi.fn(),
}

beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  vi.clearAllMocks()
  harness.actions = []
  harness.confirmation = undefined
  host = document.createElement('div')
  root = createRoot(host)
})

afterEach(async () => {
  await act(async () => root.unmount())
  vi.unstubAllGlobals()
})

it('keeps the back target and exposes the existing editor actions from floating chrome', async () => {
  await act(async () =>
    root.render(
      createElement(PhoneEditorGlassChrome, {
        favorite: false,
        noteTitle: 'A note',
        rawMode: false,
        titleVisible: true,
        onBack: callbacks.back,
        onDeleteNote: callbacks.delete,
        onExportPdf: callbacks.pdf,
        onFind: callbacks.find,
        onMove: callbacks.move,
        onOpenProperties: callbacks.properties,
        onRename: callbacks.rename,
        onToggleFavorite: callbacks.favorite,
        onToggleSourceMode: callbacks.source,
        onTitlePress: callbacks.rename,
      }),
    ),
  )

  await act(async () => host.querySelector<HTMLButtonElement>('[data-testid="phone-editor-back"]')?.click())
  expect(callbacks.back).toHaveBeenCalledOnce()
  await act(async () => host.querySelector<HTMLButtonElement>('[aria-label="A note"]')?.click())
  expect(callbacks.rename).toHaveBeenCalledOnce()
  expect(harness.actions.map(({ id }) => id)).toEqual(['favorite', 'source', 'properties', 'rename', 'move', 'find', 'pdf', 'delete'])
  await act(async () => host.querySelector<HTMLButtonElement>('[data-testid="invoke-menu-favorite"]')?.click())
  expect(harness.dismiss).toHaveBeenCalledOnce()
  expect(callbacks.favorite).toHaveBeenCalledOnce()
  expect(harness.confirmation).toBeUndefined()
})

it('confirms destructive delete before invoking the existing delete callback', async () => {
  await act(async () =>
    root.render(
      createElement(PhoneEditorGlassChrome, {
        favorite: false,
        noteTitle: 'A note',
        rawMode: false,
        titleVisible: false,
        onBack: callbacks.back,
        onDeleteNote: callbacks.delete,
        onExportPdf: callbacks.pdf,
        onFind: callbacks.find,
        onMove: callbacks.move,
        onOpenProperties: callbacks.properties,
        onRename: callbacks.rename,
        onToggleFavorite: callbacks.favorite,
        onToggleSourceMode: callbacks.source,
        onTitlePress: callbacks.rename,
      }),
    ),
  )

  await act(async () => host.querySelector<HTMLButtonElement>('[data-testid="menu-delete"]')?.click())
  expect(harness.dismiss).toHaveBeenCalledOnce()
  expect(callbacks.delete).not.toHaveBeenCalled()
  expect(harness.confirmation).toBeTypeOf('function')
  await act(async () => harness.confirmation?.())
  expect(callbacks.delete).toHaveBeenCalledOnce()
})
