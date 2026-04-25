import type React from 'react'

function isInlineWikilinkCompositionEvent(
  event: React.KeyboardEvent<HTMLDivElement>,
  isComposing: boolean,
) {
  return isComposing
    || event.nativeEvent.isComposing
    || event.key === 'Process'
    || event.keyCode === 229
}

interface HandleSuggestionKeysArgs {
  event: React.KeyboardEvent<HTMLDivElement>
  isComposing: boolean
  suggestionsOpen: boolean
  onCycleSuggestions: (direction: 1 | -1) => void
  onSelectSuggestion: () => void
}

function handleSuggestionKeys({
  event,
  isComposing,
  suggestionsOpen,
  onCycleSuggestions,
  onSelectSuggestion,
}: HandleSuggestionKeysArgs): boolean {
  if (!suggestionsOpen) return false
  if (isInlineWikilinkCompositionEvent(event, isComposing)) return false

  if (event.key === 'ArrowDown') {
    event.preventDefault()
    onCycleSuggestions(1)
    return true
  }

  if (event.key === 'ArrowUp') {
    event.preventDefault()
    onCycleSuggestions(-1)
    return true
  }

  if (event.key === 'Enter') {
    event.preventDefault()
    onSelectSuggestion()
    return true
  }

  return false
}

interface HandleDeleteKeysArgs {
  event: React.KeyboardEvent<HTMLDivElement>
  isComposing: boolean
  onDeleteContent: (direction: 'backward' | 'forward') => void
}

function handleDeleteKeys({
  event,
  isComposing,
  onDeleteContent,
}: HandleDeleteKeysArgs): boolean {
  if (isInlineWikilinkCompositionEvent(event, isComposing)) return false

  if (event.key === 'Backspace') {
    event.preventDefault()
    onDeleteContent('backward')
    return true
  }

  if (event.key === 'Delete') {
    event.preventDefault()
    onDeleteContent('forward')
    return true
  }

  return false
}

interface HandleInsertTextArgs {
  event: React.KeyboardEvent<HTMLDivElement>
  isComposing: boolean
  onInsertText: (text: string) => void
}

function handleInsertText({
  event,
  isComposing,
  onInsertText,
}: HandleInsertTextArgs): boolean {
  if (event.metaKey || event.ctrlKey || event.altKey) return false
  if (isInlineWikilinkCompositionEvent(event, isComposing)) return false
  if (event.key.length !== 1) return false

  event.preventDefault()
  onInsertText(event.key)
  return true
}

interface HandleSubmitKeyArgs {
  event: React.KeyboardEvent<HTMLDivElement>
  isComposing: boolean
  canSubmit: boolean
  onSubmit: () => void
}

function handleSubmitKey({
  event,
  isComposing,
  canSubmit,
  onSubmit,
}: HandleSubmitKeyArgs): boolean {
  if (!canSubmit) return false
  if (isInlineWikilinkCompositionEvent(event, isComposing)) return false
  if (event.key !== 'Enter' || event.shiftKey) return false

  event.preventDefault()
  onSubmit()
  return true
}

interface HandleInlineWikilinkKeyDownArgs {
  event: React.KeyboardEvent<HTMLDivElement>
  disabled: boolean
  isComposing: boolean
  suggestionsOpen: boolean
  onCycleSuggestions: (direction: 1 | -1) => void
  onSelectSuggestion: () => void
  onDeleteContent: (direction: 'backward' | 'forward') => void
  onInsertText: (text: string) => void
  canSubmit: boolean
  onSubmit: () => void
}

export function handleInlineWikilinkKeyDown({
  event,
  disabled,
  isComposing,
  suggestionsOpen,
  onCycleSuggestions,
  onSelectSuggestion,
  onDeleteContent,
  onInsertText,
  canSubmit,
  onSubmit,
}: HandleInlineWikilinkKeyDownArgs) {
  if (disabled) return

  if (handleSuggestionKeys({
    event,
    isComposing,
    suggestionsOpen,
    onCycleSuggestions,
    onSelectSuggestion,
  })) {
    return
  }

  if (handleDeleteKeys({ event, isComposing, onDeleteContent })) {
    return
  }

  if (handleInsertText({ event, isComposing, onInsertText })) {
    return
  }

  handleSubmitKey({ event, isComposing, canSubmit, onSubmit })
}
