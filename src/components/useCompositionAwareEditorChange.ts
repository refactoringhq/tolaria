import { useCallback, useEffect, useMemo, useRef, type RefObject } from 'react'

const IME_COMMIT_RECONCILIATION_FALLBACK_MS = 50

type CompositionChangeState = {
  composing: { current: boolean }
  onChange: { current?: () => void }
  pendingChange: { current: boolean }
  pendingTimer: { current: ReturnType<typeof setTimeout> | null }
}

function clearPendingTimer(state: CompositionChangeState) {
  if (state.pendingTimer.current === null) return
  clearTimeout(state.pendingTimer.current)
  state.pendingTimer.current = null
}

function flushPendingChange(state: CompositionChangeState) {
  state.pendingTimer.current = null
  if (state.composing.current || !state.pendingChange.current) return
  state.pendingChange.current = false
  state.onChange.current?.()
}

function registerCompositionListeners(
  container: HTMLDivElement,
  state: CompositionChangeState,
) {
  const handleCompositionStart = () => {
    clearPendingTimer(state)
    state.composing.current = true
  }
  const handleCompositionEnd = () => {
    state.composing.current = false
    clearPendingTimer(state)
    state.pendingTimer.current = setTimeout(
      () => flushPendingChange(state),
      IME_COMMIT_RECONCILIATION_FALLBACK_MS,
    )
  }

  container.addEventListener('compositionstart', handleCompositionStart, true)
  container.addEventListener('compositionend', handleCompositionEnd, true)
  return () => {
    clearPendingTimer(state)
    container.removeEventListener('compositionstart', handleCompositionStart, true)
    container.removeEventListener('compositionend', handleCompositionEnd, true)
  }
}

function publishEditorChange(state: CompositionChangeState) {
  if (state.composing.current) {
    state.pendingChange.current = true
    return
  }

  clearPendingTimer(state)
  state.pendingChange.current = false
  state.onChange.current?.()
}

export function useCompositionAwareEditorChange(options: {
  containerRef: RefObject<HTMLDivElement | null>
  onChange?: () => void
}) {
  const { containerRef, onChange } = options
  const onChangeRef = useRef(onChange)
  const composingRef = useRef(false)
  const pendingChangeRef = useRef(false)
  const pendingFlushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const state = useMemo<CompositionChangeState>(
    () => ({
      composing: composingRef,
      onChange: onChangeRef,
      pendingChange: pendingChangeRef,
      pendingTimer: pendingFlushTimerRef,
    }),
    [],
  )

  useEffect(() => {
    onChangeRef.current = onChange
  }, [onChange])

  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    return registerCompositionListeners(container, state)
  }, [containerRef, state])

  return useCallback(() => publishEditorChange(state), [state])
}
