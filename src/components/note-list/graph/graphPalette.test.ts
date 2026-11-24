import { act, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { makeEntry } from '../../../test-utils/noteListTestUtils'
import { mixColors, readGraphPalette, rgbChannels, useThemeSignature, withAlpha } from './graphPalette'

describe('graphPalette', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('turns resolved colors into rgba strings WebGL can read', () => {
    expect(rgbChannels('rgb(229, 62, 62)')).toEqual([229, 62, 62])
    expect(withAlpha('rgba(1, 2, 3, 0.2)', 0.5)).toBe('rgba(1, 2, 3, 0.5)')
    expect(withAlpha('not a color', 1)).toBe('rgba(128, 128, 128, 1)')
  })

  it('resolves node colors per type through a probe it removes on dispose', () => {
    const host = document.createElement('div')
    document.body.appendChild(host)
    const palette = readGraphPalette(host, {})
    const project = makeEntry({ isA: 'Project' })
    expect(palette.nodeColor(project)).toMatch(/^rgba\(/)
    expect(palette.nodeColor(project)).toBe(palette.nodeColor(makeEntry({ isA: 'Project', path: '/other.md' })))
    expect(palette.wikiLinkEdge).toMatch(/0\.4\)$/)
    expect(host.children).toHaveLength(1)
    palette.dispose()
    expect(host.children).toHaveLength(0)
    host.remove()
  })

  it('blends two colors for the hover accent', () => {
    expect(mixColors('rgb(0, 0, 0)', 'rgb(200, 100, 50)', 0)).toBe('rgba(0, 0, 0, 1)')
    expect(mixColors('rgb(0, 0, 0)', 'rgb(200, 100, 50)', 0.5)).toBe('rgba(100, 50, 25, 1)')
    expect(mixColors('rgba(0, 0, 0, 0.4)', 'rgb(200, 100, 50)', 1)).toBe('rgba(200, 100, 50, 1)')
  })

  it('colors a note by its type', () => {
    const host = document.createElement('div')
    document.body.appendChild(host)
    const resolved: Record<string, string> = { 'var(--accent-red)': 'rgb(255, 0, 0)', 'var(--accent-blue)': 'rgb(0, 0, 255)' }
    vi.spyOn(window, 'getComputedStyle').mockImplementation(
      (element) => ({ color: resolved[String(Reflect.get(Reflect.get(element, 'style'), 'color'))] ?? '' }) as CSSStyleDeclaration,
    )
    const palette = readGraphPalette(host, { Person: makeEntry({ title: 'Person', color: 'red' }) })
    const ada = makeEntry({ title: 'Ada', isA: 'Person' })
    const grace = makeEntry({ title: 'Grace', isA: 'Person', path: '/grace.md' })
    expect(palette.nodeColor(ada)).toBe('rgba(255, 0, 0, 1)')
    expect(palette.nodeColor(grace)).toBe(palette.nodeColor(ada))
    expect(palette.accent).toMatch(/, 1\)$/)
    palette.dispose()
    host.remove()
  })

  it('reports a new signature when the theme changes', async () => {
    const { result } = renderHook(() => useThemeSignature())
    const before = result.current
    await act(async () => {
      document.documentElement.setAttribute('data-theme', 'dark')
      await Promise.resolve()
    })
    expect(result.current).not.toBe(before)
    document.documentElement.removeAttribute('data-theme')
  })
})
