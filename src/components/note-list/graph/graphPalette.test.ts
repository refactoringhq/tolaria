import { act, renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { makeEntry } from '../../../test-utils/noteListTestUtils'
import { readGraphPalette, rgbChannels, useThemeSignature, withAlpha } from './graphPalette'

describe('graphPalette', () => {
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
