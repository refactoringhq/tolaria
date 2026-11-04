// @vitest-environment jsdom
import { act, createElement, type ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { MobileTransientNotice } from './MobileTransientNotice.internal'

vi.mock('react-native', () => ({
	AccessibilityInfo: { announceForAccessibility: vi.fn() },
	StyleSheet: { create: (styles: object) => styles },
	View: ({ children, pointerEvents, testID }: { children?: unknown; pointerEvents?: string; testID?: string }) =>
		createElement('div', { 'data-testid': testID, 'data-pointer-events': pointerEvents }, children as ReactNode),
}))
vi.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0 }) }))
vi.mock('../../ui/theme/useMobileTheme', () => ({
	useMobileStyles: (factory: (colors: object, metrics: object) => object) => ({
		styles: factory(
			{ borderStrong: '#aaa', popover: '#fff', text: '#111' },
			{ size: (value: number) => value },
		),
	}),
}))
vi.mock('../ui/text', () => ({
	Text: ({ children, testID }: { children?: unknown; testID?: string }) =>
		createElement('span', { 'data-testid': testID }, children as ReactNode),
}))

let host: HTMLDivElement
let root: ReturnType<typeof createRoot>

beforeEach(() => {
	vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
	vi.useFakeTimers()
	host = document.createElement('div')
	root = createRoot(host)
})

afterEach(async () => {
	await act(async () => root.unmount())
	vi.useRealTimers()
	vi.unstubAllGlobals()
})

it('shows a nonblocking notice and dismisses it after a short interval', async () => {
	const onDismiss = vi.fn()
	await act(async () => {
		root.render(createElement(MobileTransientNotice, { message: 'No matching notes', onDismiss }))
	})
	expect(host.querySelector('[data-testid="mobile-transient-notice"]')?.textContent).toBe('No matching notes')
	expect(host.querySelector('[data-testid="mobile-transient-notice"]')?.parentElement?.getAttribute('data-pointer-events')).toBe('none')
	await act(async () => vi.advanceTimersByTime(2400))
	expect(onDismiss).toHaveBeenCalledOnce()
})
