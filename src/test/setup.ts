import '@testing-library/jest-dom/vitest'
import { vi } from 'vitest'
import { createElement, type ReactNode, type ComponentType } from 'react'

// Mock scrollIntoView for jsdom (not implemented)
Element.prototype.scrollIntoView = vi.fn()

// Mock ResizeObserver for jsdom (not implemented)
globalThis.ResizeObserver = class {
  observe() {}
  unobserve() {}
  disconnect() {}
} as unknown as typeof ResizeObserver

// Mock @tauri-apps/plugin-opener for test environment
vi.mock('@tauri-apps/plugin-opener', () => ({
  openUrl: vi.fn(),
}))

// Mock react-day-picker: Calendar component uses DayPicker which needs real DOM APIs not available in jsdom
vi.mock('react-day-picker', () => ({
  DayPicker: () => null,
  getDefaultClassNames: () => ({}),
}))

// Mock react-virtuoso: JSDOM has no real viewport, so render all items directly
vi.mock('react-virtuoso', () => ({
  Virtuoso: ({ data, itemContent, components }: {
    data?: unknown[]
    itemContent?: (index: number, item: unknown) => ReactNode
    components?: { Header?: ComponentType }
  }) => {
    const Header = components?.Header
    return createElement('div', { 'data-testid': 'virtuoso-mock' },
      Header ? createElement(Header) : null,
      data?.map((item: unknown, index: number) =>
        createElement('div', { key: index }, itemContent?.(index, item))
      )
    )
  },
  GroupedVirtuoso: ({ groupCounts, groupContent, itemContent }: {
    groupCounts: number[]
    groupContent: (index: number) => ReactNode
    itemContent: (index: number, groupIndex: number) => ReactNode
  }) => {
    let globalIndex = 0
    return createElement('div', { 'data-testid': 'grouped-virtuoso-mock' },
      groupCounts?.map((count: number, groupIndex: number) => {
        const items = []
        for (let i = 0; i < count; i++) {
          items.push(createElement('div', { key: globalIndex }, itemContent(globalIndex, groupIndex)))
          globalIndex++
        }
        return createElement('div', { key: `group-${groupIndex}` },
          groupContent(groupIndex),
          ...items
        )
      })
    )
  },
}))
