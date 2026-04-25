import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { useDocumentThemeMode } from './useDocumentThemeMode'

describe('useDocumentThemeMode', () => {
  beforeEach(() => {
    document.documentElement.removeAttribute('data-theme')
    document.documentElement.classList.remove('dark')
  })

  it('defaults to light when no document theme is applied', () => {
    const { result } = renderHook(() => useDocumentThemeMode())

    expect(result.current).toBe('light')
  })

  it('updates when the document theme changes', async () => {
    const { result } = renderHook(() => useDocumentThemeMode())

    act(() => {
      document.documentElement.setAttribute('data-theme', 'dark')
      document.documentElement.classList.add('dark')
    })

    await waitFor(() => {
      expect(result.current).toBe('dark')
    })
  })
})
