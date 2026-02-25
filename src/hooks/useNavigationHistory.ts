import { useCallback, useEffect, useRef, useState } from 'react'

interface HistoryState {
  stack: string[]
  cursor: number
}

const EMPTY: HistoryState = { stack: [], cursor: -1 }
const MAX_HISTORY = 200

/**
 * Manages a browser-style back/forward navigation stack of note paths.
 *
 * - `push(path)` adds a path, clearing any forward history.
 * - `goBack()` / `goForward()` return the target path (or null).
 * - Deleted/invalid paths are skipped transparently.
 */
export function useNavigationHistory() {
  const [state, setState] = useState<HistoryState>(EMPTY)
  const stateRef = useRef(state)
  useEffect(() => { stateRef.current = state })

  const push = useCallback((path: string) => {
    setState((prev) => {
      if (prev.cursor >= 0 && prev.stack[prev.cursor] === path) return prev
      const truncated = prev.stack.slice(0, prev.cursor + 1)
      const stack = truncated.length >= MAX_HISTORY
        ? [...truncated.slice(truncated.length - MAX_HISTORY + 1), path]
        : [...truncated, path]
      return { stack, cursor: stack.length - 1 }
    })
  }, [])

  const canGoBack = state.cursor > 0
  const canGoForward = state.cursor < state.stack.length - 1

  const goBack = useCallback((isValid?: (path: string) => boolean): string | null => {
    const { stack, cursor } = stateRef.current
    for (let i = cursor - 1; i >= 0; i--) {
      if (!isValid || isValid(stack[i])) {
        setState({ stack, cursor: i })
        return stack[i]
      }
    }
    return null
  }, [])

  const goForward = useCallback((isValid?: (path: string) => boolean): string | null => {
    const { stack, cursor } = stateRef.current
    for (let i = cursor + 1; i < stack.length; i++) {
      if (!isValid || isValid(stack[i])) {
        setState({ stack, cursor: i })
        return stack[i]
      }
    }
    return null
  }, [])

  /** Remove a path from history (e.g. when a tab is closed). */
  const removePath = useCallback((path: string) => {
    setState((prev) => {
      const idx = prev.stack.indexOf(path)
      if (idx === -1) return prev
      const stack = prev.stack.filter((p) => p !== path)
      const cursor = prev.cursor > idx ? prev.cursor - 1
        : prev.cursor === idx ? Math.min(prev.cursor, stack.length - 1)
        : prev.cursor
      return { stack, cursor: Math.max(cursor, stack.length > 0 ? 0 : -1) }
    })
  }, [])

  return { canGoBack, canGoForward, push, goBack, goForward, removePath }
}
