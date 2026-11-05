// @vitest-environment jsdom
import { act, createElement, type ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { MobileEditorBlocks } from './MobileEditorBlocks'

vi.mock('react-native', () => ({
  Pressable: ({ accessibilityState, accessibilityLabel, accessibilityRole, ...props }: Record<string, unknown>) =>
		createElement('button', {
			'aria-checked': (accessibilityState as { checked?: boolean }).checked,
			'aria-label': accessibilityLabel,
			'data-testid': props.testID,
			disabled: props.disabled,
			onClick: props.onPress,
			role: accessibilityRole,
			type: 'button',
		}, props.children as ReactNode),
	View: ({ children, testID }: { children?: unknown; testID?: string }) =>
		createElement('div', { 'data-testid': testID }, children as ReactNode),
	}))
vi.mock('phosphor-react-native', () => ({ CheckSquare: () => null, Square: () => null }))
vi.mock('../ui/text', () => ({
	Text: ({ children, testID }: { children?: unknown; testID?: string }) =>
		createElement('span', { 'data-testid': testID }, children as ReactNode),
}))
vi.mock('./mobileEditorBlockStyles', () => ({ createEditorBlockStyles: () => ({}) }))
vi.mock('../../ui/theme/useMobileTheme', () => ({
	useMobileStyles: () => ({
		metrics: { editor: { listCheckboxSize: 18 }, size: (value: number) => value },
		listStyles: { group: {}, taskIcon: {}, taskRow: {} },
		mobileColors: { primary: '#00f', textMuted: '#777' },
		textStyles: { body: {} },
	}),
}))

let host: HTMLDivElement
let root: ReturnType<typeof createRoot>

beforeEach(() => {
	vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
	host = document.createElement('div')
	root = createRoot(host)
})

afterEach(async () => {
	await act(async () => root.unmount())
	vi.unstubAllGlobals()
})

it('lets read-only task checkboxes toggle and exposes their checked state', async () => {
	const onToggleTask = vi.fn()
	await act(async () => root.render(createElement(MobileEditorBlocks, {
		blocks: [{ kind: 'tasks', items: [{ checked: false, content: [{ text: 'Review this' }], sourceLine: 4 } as { checked: boolean; content: Array<{ text: string }>; sourceLine: number }] }],
		fallbackBullets: [],
		interactions: { onNavigateWikilink: vi.fn(), onToggleTask },
	})))

	const checkbox = host.querySelector<HTMLButtonElement>('[data-testid="editor-task-checkbox"]')
	expect(checkbox?.getAttribute('role')).toBe('checkbox')
	expect(checkbox?.getAttribute('aria-checked')).toBe('false')
	await act(async () => checkbox?.click())
	expect(onToggleTask).toHaveBeenCalledWith(4)
})
