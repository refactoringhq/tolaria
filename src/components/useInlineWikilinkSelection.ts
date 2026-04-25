import {
  useCallback,
  useLayoutEffect,
  useRef,
  useState,
} from 'react'
import {
  applySelectionRange,
  readSelectionRange,
  serializeInlineNode,
  type InlineSelectionRange,
} from './inlineWikilinkDom'
import { normalizeInlineWikilinkValue } from './inlineWikilinkTokens'

interface UseInlineWikilinkSelectionArgs {
  value: string
  onChange: (value: string) => void
  inputRef?: React.RefObject<HTMLDivElement | null>
  isComposingRef?: React.RefObject<boolean>
}

export function useInlineWikilinkSelection({
  value,
  onChange,
  inputRef,
  isComposingRef,
}: UseInlineWikilinkSelectionArgs) {
  const editorRef = useRef<HTMLDivElement | null>(null)
  const [selectionRange, setSelectionRange] = useState<InlineSelectionRange>({
    start: value.length,
    end: value.length,
  })

  const setCombinedRef = useCallback((node: HTMLDivElement | null) => {
    editorRef.current = node
    if (inputRef) {
      inputRef.current = node
    }
  }, [inputRef])

  const syncSelectionRange = useCallback(() => {
    if (!editorRef.current) return
    if (isComposingRef?.current) return
    setSelectionRange(readSelectionRange(editorRef.current))
  }, [isComposingRef])

  const focusSelectionRange = useCallback((nextSelectionRange: InlineSelectionRange) => {
    const editor = editorRef.current
    if (!editor) return
    editor.focus()
    applySelectionRange(editor, nextSelectionRange)
  }, [])

  const commitValueFromEditor = useCallback(() => {
    if (!editorRef.current) return

    const nextValue = normalizeInlineWikilinkValue(serializeInlineNode(editorRef.current))
    const nextSelectionRange = readSelectionRange(editorRef.current)

    onChange(nextValue)
    setSelectionRange({
      start: Math.min(nextSelectionRange.start, nextValue.length),
      end: Math.min(nextSelectionRange.end, nextValue.length),
    })
  }, [onChange])

  useLayoutEffect(() => {
    const editor = editorRef.current
    if (!editor) return
    if (document.activeElement !== editor) return
    if (isComposingRef?.current) return
    applySelectionRange(editor, selectionRange)
  }, [isComposingRef, selectionRange, value])

  return {
    editorRef,
    selectionRange,
    selectionIndex: selectionRange.end,
    setSelectionRange,
    setCombinedRef,
    syncSelectionRange,
    focusSelectionRange,
    commitValueFromEditor,
  }
}
