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

function getSelectionSyncEditor(
  editor: HTMLDivElement | null,
  isComposingRef?: React.RefObject<boolean>,
) {
  if (!editor || isComposingRef?.current === true) return null
  return editor
}

function removeImeLeftoverTextNodes(editor: HTMLDivElement) {
  // IME composition (Korean/Japanese/Chinese) inserts plain text nodes
  // directly inside the contentEditable div, outside of React's reconciliation
  // tree. After we commit the composed value, those orphan nodes survive the
  // React re-render and accumulate as siblings on the next composition,
  // producing per-syllable duplication (e.g. typing 안녕 → "안안녕녕").
  //
  // We only strip text nodes that sit alongside React-rendered element
  // children (spans/chips). When the editor holds only text — for example,
  // right after a manual `editor.textContent = ...` write before React has
  // had a chance to mount its span — we leave it alone so we don't blank
  // the field.
  const hasElementChildren = Array.from(editor.childNodes).some(
    (child) => child.nodeType === Node.ELEMENT_NODE,
  )
  if (!hasElementChildren) return

  for (const child of Array.from(editor.childNodes)) {
    if (child.nodeType !== Node.TEXT_NODE) continue
    if (child.textContent === '​') continue
    editor.removeChild(child)
  }
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
    const editor = getSelectionSyncEditor(editorRef.current, isComposingRef)
    if (!editor) return
    setSelectionRange(readSelectionRange(editor))
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
    if (isComposingRef?.current === true) return
    removeImeLeftoverTextNodes(editor)
    if (document.activeElement !== editor) return
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
