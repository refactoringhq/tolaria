import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useZoom } from './useZoom'

// Mock localStorage (jsdom's may be incomplete)
const localStorageMock = (() => {
  let store: Record<string, string> = {}
  return {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => { store[key] = value }),
    removeItem: vi.fn((key: string) => { delete store[key] }),
    clear: vi.fn(() => { store = {} }),
  }
})()
Object.defineProperty(globalThis, 'localStorage', { value: localStorageMock, writable: true })

describe('useZoom', () => {
  beforeEach(() => {
    localStorageMock.clear()
    document.documentElement.style.removeProperty('zoom')
  })

  it('initializes at 100% by default', () => {
    const { result } = renderHook(() => useZoom())
    expect(result.current.zoomLevel).toBe(100)
  })

  it('restores persisted zoom level from localStorage', () => {
    localStorageMock.setItem('laputa:zoom-level', '120')
    const { result } = renderHook(() => useZoom())
    expect(result.current.zoomLevel).toBe(120)
  })

  it('ignores invalid persisted values', () => {
    localStorageMock.setItem('laputa:zoom-level', 'banana')
    const { result } = renderHook(() => useZoom())
    expect(result.current.zoomLevel).toBe(100)
  })

  it('ignores out-of-range persisted values', () => {
    localStorageMock.setItem('laputa:zoom-level', '200')
    const { result } = renderHook(() => useZoom())
    expect(result.current.zoomLevel).toBe(100)
  })

  it('zoomIn increases level by 10', () => {
    const { result } = renderHook(() => useZoom())
    act(() => result.current.zoomIn())
    expect(result.current.zoomLevel).toBe(110)
    expect(localStorageMock.getItem('laputa:zoom-level')).toBe('110')
  })

  it('zoomOut decreases level by 10', () => {
    const { result } = renderHook(() => useZoom())
    act(() => result.current.zoomOut())
    expect(result.current.zoomLevel).toBe(90)
    expect(localStorageMock.getItem('laputa:zoom-level')).toBe('90')
  })

  it('zoomIn clamps at 150', () => {
    localStorageMock.setItem('laputa:zoom-level', '150')
    const { result } = renderHook(() => useZoom())
    act(() => result.current.zoomIn())
    expect(result.current.zoomLevel).toBe(150)
  })

  it('zoomOut clamps at 80', () => {
    localStorageMock.setItem('laputa:zoom-level', '80')
    const { result } = renderHook(() => useZoom())
    act(() => result.current.zoomOut())
    expect(result.current.zoomLevel).toBe(80)
  })

  it('zoomReset returns to 100', () => {
    localStorageMock.setItem('laputa:zoom-level', '130')
    const { result } = renderHook(() => useZoom())
    act(() => result.current.zoomReset())
    expect(result.current.zoomLevel).toBe(100)
    expect(localStorageMock.getItem('laputa:zoom-level')).toBe('100')
  })

  it('applies CSS zoom property to document element', () => {
    const spy = vi.spyOn(document.documentElement.style, 'setProperty')
    const { result } = renderHook(() => useZoom())
    spy.mockClear() // clear the mount call
    act(() => result.current.zoomIn())
    expect(spy).toHaveBeenCalledWith('zoom', '110%')
    spy.mockRestore()
  })

  it('zoomIn and zoomOut are stable callbacks', () => {
    const { result, rerender } = renderHook(() => useZoom())
    const { zoomIn: a, zoomOut: b, zoomReset: c } = result.current
    rerender()
    expect(result.current.zoomIn).toBe(a)
    expect(result.current.zoomOut).toBe(b)
    expect(result.current.zoomReset).toBe(c)
  })

  it('successive zoomIn calls accumulate', () => {
    const { result } = renderHook(() => useZoom())
    act(() => result.current.zoomIn())
    act(() => result.current.zoomIn())
    act(() => result.current.zoomIn())
    expect(result.current.zoomLevel).toBe(130)
  })

  it('handles localStorage getItem throwing', () => {
    localStorageMock.getItem.mockImplementationOnce(() => { throw new Error('no storage') })
    const { result } = renderHook(() => useZoom())
    expect(result.current.zoomLevel).toBe(100)
  })
})
