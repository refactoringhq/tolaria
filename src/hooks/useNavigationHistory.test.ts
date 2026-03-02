import { describe, it, expect } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useNavigationHistory } from './useNavigationHistory'

describe('useNavigationHistory', () => {
  it('starts with empty state', () => {
    const { result } = renderHook(() => useNavigationHistory())
    expect(result.current.canGoBack).toBe(false)
    expect(result.current.canGoForward).toBe(false)
  })

  it('push adds path to history', () => {
    const { result } = renderHook(() => useNavigationHistory())
    act(() => result.current.push('/a'))
    expect(result.current.canGoBack).toBe(false)
    expect(result.current.canGoForward).toBe(false)
  })

  it('back returns previous path after two pushes', () => {
    const { result } = renderHook(() => useNavigationHistory())
    act(() => { result.current.push('/a'); result.current.push('/b') })
    expect(result.current.canGoBack).toBe(true)

    let target: string | null = null
    act(() => { target = result.current.goBack() })
    expect(target).toBe('/a')
    expect(result.current.canGoBack).toBe(false)
    expect(result.current.canGoForward).toBe(true)
  })

  it('forward returns next path after going back', () => {
    const { result } = renderHook(() => useNavigationHistory())
    act(() => { result.current.push('/a'); result.current.push('/b') })
    act(() => { result.current.goBack() })

    let target: string | null = null
    act(() => { target = result.current.goForward() })
    expect(target).toBe('/b')
    expect(result.current.canGoForward).toBe(false)
  })

  it('push after back clears forward stack', () => {
    const { result } = renderHook(() => useNavigationHistory())
    act(() => { result.current.push('/a'); result.current.push('/b'); result.current.push('/c') })
    act(() => { result.current.goBack() })
    expect(result.current.canGoForward).toBe(true)

    act(() => { result.current.push('/d') })
    expect(result.current.canGoForward).toBe(false)

    let target: string | null = null
    act(() => { target = result.current.goBack() })
    expect(target).toBe('/b')
  })

  it('duplicate push is a no-op', () => {
    const { result } = renderHook(() => useNavigationHistory())
    act(() => { result.current.push('/a'); result.current.push('/a') })
    expect(result.current.canGoBack).toBe(false)
  })

  it('goBack skips invalid paths', () => {
    const { result } = renderHook(() => useNavigationHistory())
    act(() => { result.current.push('/a'); result.current.push('/b'); result.current.push('/c') })

    let target: string | null = null
    act(() => { target = result.current.goBack((p) => p !== '/b') })
    expect(target).toBe('/a')
  })

  it('goForward skips invalid paths', () => {
    const { result } = renderHook(() => useNavigationHistory())
    act(() => { result.current.push('/a'); result.current.push('/b'); result.current.push('/c') })
    act(() => { result.current.goBack(); result.current.goBack() })

    let target: string | null = null
    act(() => { target = result.current.goForward((p) => p !== '/b') })
    expect(target).toBe('/c')
  })

  it('goBack returns null when nothing valid remains', () => {
    const { result } = renderHook(() => useNavigationHistory())
    act(() => { result.current.push('/a') })

    let target: string | null = 'should-be-null'
    act(() => { target = result.current.goBack() })
    expect(target).toBeNull()
  })

  it('goForward returns null at end of history', () => {
    const { result } = renderHook(() => useNavigationHistory())
    act(() => { result.current.push('/a') })

    let target: string | null = 'should-be-null'
    act(() => { target = result.current.goForward() })
    expect(target).toBeNull()
  })

  it('removePath adjusts cursor correctly', () => {
    const { result } = renderHook(() => useNavigationHistory())
    act(() => { result.current.push('/a'); result.current.push('/b'); result.current.push('/c') })
    act(() => { result.current.removePath('/b') })

    let target: string | null = null
    act(() => { target = result.current.goBack() })
    expect(target).toBe('/a')
  })

  it('removePath when current note is removed', () => {
    const { result } = renderHook(() => useNavigationHistory())
    act(() => { result.current.push('/a'); result.current.push('/b') })
    act(() => { result.current.removePath('/b') })
    // After removing /b (cursor was at index 1), cursor should adjust
    expect(result.current.canGoBack).toBe(false)
    expect(result.current.canGoForward).toBe(false)
  })

  it('goBack without predicate returns closed-tab paths (replace scenario)', () => {
    const { result } = renderHook(() => useNavigationHistory())
    // Simulate: open A, then B replaces A, then C replaces B
    act(() => { result.current.push('/a'); result.current.push('/b'); result.current.push('/c') })

    // Without a predicate, goBack returns /b even though its tab was replaced
    let target: string | null = null
    act(() => { target = result.current.goBack() })
    expect(target).toBe('/b')

    act(() => { target = result.current.goBack() })
    expect(target).toBe('/a')
  })

  it('goBack with entry-exists predicate skips deleted notes but returns replaced tabs', () => {
    const { result } = renderHook(() => useNavigationHistory())
    act(() => { result.current.push('/a'); result.current.push('/deleted'); result.current.push('/c') })

    // Simulate: /deleted was removed from vault, but /a still exists
    const vaultPaths = new Set(['/a', '/c'])
    const isEntryExists = (p: string) => vaultPaths.has(p)

    let target: string | null = null
    act(() => { target = result.current.goBack(isEntryExists) })
    // Should skip /deleted and return /a
    expect(target).toBe('/a')
  })

  it('goForward with entry-exists predicate skips deleted notes', () => {
    const { result } = renderHook(() => useNavigationHistory())
    act(() => { result.current.push('/a'); result.current.push('/deleted'); result.current.push('/c') })
    act(() => { result.current.goBack(); result.current.goBack() })

    const vaultPaths = new Set(['/a', '/c'])
    const isEntryExists = (p: string) => vaultPaths.has(p)

    let target: string | null = null
    act(() => { target = result.current.goForward(isEntryExists) })
    // Should skip /deleted and return /c
    expect(target).toBe('/c')
  })

  it('handles long navigation chain', () => {
    const { result } = renderHook(() => useNavigationHistory())
    act(() => {
      for (let i = 0; i < 10; i++) result.current.push(`/${i}`)
    })
    expect(result.current.canGoBack).toBe(true)

    // Go all the way back
    for (let i = 8; i >= 0; i--) {
      let target: string | null = null
      act(() => { target = result.current.goBack() })
      expect(target).toBe(`/${i}`)
    }
    expect(result.current.canGoBack).toBe(false)

    // Go all the way forward
    for (let i = 1; i <= 9; i++) {
      let target: string | null = null
      act(() => { target = result.current.goForward() })
      expect(target).toBe(`/${i}`)
    }
    expect(result.current.canGoForward).toBe(false)
  })
})
