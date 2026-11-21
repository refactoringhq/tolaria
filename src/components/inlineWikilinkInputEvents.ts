import type { KeyboardEvent as ReactKeyboardEvent } from 'react'

export function collapseSelectionRange(nextSelectionIndex: number) {
  return {
    start: nextSelectionIndex,
    end: nextSelectionIndex,
  }
}

export function fullSelectionRange(value: string) {
  return {
    start: 0,
    end: value.length,
  }
}

export function isSelectAllShortcut(event: ReactKeyboardEvent<HTMLDivElement>) {
  return event.key.toLowerCase() === 'a' && (event.metaKey || event.ctrlKey)
}

export function isCommandBackspaceShortcut(event: ReactKeyboardEvent<HTMLDivElement>) {
  return event.key === 'Backspace' && event.metaKey && !event.ctrlKey && !event.altKey && !event.shiftKey
}

export function isCompositionKeyboardEvent(event: ReactKeyboardEvent<HTMLDivElement>, isComposing: boolean) {
  return isComposing || event.nativeEvent.isComposing || event.keyCode === 229
}

export const IME_KEYDOWN_SIGNAL_WINDOW_MS = 500

export function isWindowsRuntime(): boolean {
  return typeof navigator !== 'undefined' && /Windows/i.test(navigator.userAgent)
}

export function isLineBreakShortcut(event: ReactKeyboardEvent<HTMLDivElement>, isComposing: boolean) {
  return (
    event.key === 'Enter' &&
    (event.shiftKey || event.ctrlKey) &&
    !isComposing &&
    !event.nativeEvent.isComposing &&
    event.keyCode !== 229
  )
}

type CompositionBeforeInputLike = {
  timeStamp?: unknown
  isComposing?: unknown
  inputType?: unknown
}

function isImeKeyDownSignalActive(
  nativeEvent: CompositionBeforeInputLike,
  lastImeKeyDownAt: number | null,
): boolean {
  if (lastImeKeyDownAt === null || typeof nativeEvent.timeStamp !== 'number') return false

  const elapsed = nativeEvent.timeStamp - lastImeKeyDownAt
  return elapsed >= 0 && elapsed <= IME_KEYDOWN_SIGNAL_WINDOW_MS
}

export function isNativeCompositionBeforeInput(
  nativeEvent: InputEvent,
  isComposing: boolean,
  hasPendingCompositionInput: boolean,
  isSettlingComposition: boolean,
  lastImeKeyDownAt: number | null = null,
) {
  return (
    isComposing ||
    hasPendingCompositionInput ||
    nativeEvent.isComposing ||
    nativeEvent.inputType === 'insertCompositionText' ||
    isImeKeyDownSignalActive(nativeEvent, lastImeKeyDownAt) ||
    (isSettlingComposition && nativeEvent.inputType === 'insertText' && typeof nativeEvent.data === 'string')
  )
}
