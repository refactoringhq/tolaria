import { useCallback, useState } from 'react'
import { CODE_BLOCK_SELECTOR } from './editorRichCopy'

export type CodeBlockCopyTarget = {
  codeBlock: HTMLElement
  left: number
  top: number
}

function codeBlockCopyTarget(codeBlock: HTMLElement, container: HTMLElement): CodeBlockCopyTarget {
  const codeBlockRect = codeBlock.getBoundingClientRect()
  const containerRect = container.getBoundingClientRect()
  return {
    codeBlock,
    left: codeBlockRect.right - containerRect.left + container.scrollLeft - 30,
    top: codeBlockRect.top - containerRect.top + container.scrollTop + 6,
  }
}

function sameCopyTarget(left: CodeBlockCopyTarget | null, right: CodeBlockCopyTarget): boolean {
  return Boolean(left && left.codeBlock === right.codeBlock && left.left === right.left && left.top === right.top)
}

function codeBlockFromEventTarget(
  target: EventTarget | null,
  container: HTMLDivElement | null,
): HTMLElement | null | undefined {
  if (!(target instanceof HTMLElement) || !container) return undefined
  if (target.closest('[data-editor-code-copy]')) return undefined
  const codeBlock = target.closest<HTMLElement>(CODE_BLOCK_SELECTOR)
  return codeBlock && container.contains(codeBlock) ? codeBlock : null
}

export function useCodeBlockCopyTarget(containerRef: React.RefObject<HTMLDivElement | null>) {
  const [copyTarget, setCopyTarget] = useState<CodeBlockCopyTarget | null>(null)
  const showCopyTarget = useCallback((codeBlock: HTMLElement) => {
    const container = containerRef.current
    if (!container?.contains(codeBlock)) return
    const nextTarget = codeBlockCopyTarget(codeBlock, container)
    setCopyTarget((previous) => (sameCopyTarget(previous, nextTarget) ? previous : nextTarget))
  }, [containerRef])
  const updateFromEventTarget = useCallback((target: EventTarget | null) => {
    const codeBlock = codeBlockFromEventTarget(target, containerRef.current)
    if (codeBlock) showCopyTarget(codeBlock)
    if (codeBlock === null) setCopyTarget(null)
  }, [containerRef, showCopyTarget])
  const handleMouseMove = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => updateFromEventTarget(event.target),
    [updateFromEventTarget],
  )
  const handleFocus = useCallback(
    (event: React.FocusEvent<HTMLDivElement>) => updateFromEventTarget(event.target),
    [updateFromEventTarget],
  )
  const clearCopyTarget = useCallback(() => setCopyTarget(null), [])
  return { clearCopyTarget, copyTarget, handleFocus, handleMouseMove }
}
