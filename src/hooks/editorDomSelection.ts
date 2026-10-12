export const EDITOR_CONTAINER_SELECTOR = '.editor__blocknote-container'

const EDITOR_EDITABLE_SELECTOR = `${EDITOR_CONTAINER_SELECTOR} [contenteditable="true"]`

function getElementForNode(node: Node | null): Element | null {
  if (node instanceof Element) return node
  return node?.parentElement ?? null
}

function getEditorContainers(): HTMLElement[] {
  return Array.from(document.querySelectorAll<HTMLElement>(EDITOR_CONTAINER_SELECTOR))
}

function isElementInsideEditor(element: Element | null, containers: HTMLElement[]): boolean {
  return Boolean(element && containers.some((container) => container.contains(element)))
}

function isNodeInsideEditor(node: Node | null, containers: HTMLElement[]): boolean {
  return isElementInsideEditor(getElementForNode(node), containers)
}

function blurActiveEditorElement(containers: HTMLElement[]): void {
  const activeElement = document.activeElement
  if (!(activeElement instanceof HTMLElement)) return
  if (!isElementInsideEditor(activeElement, containers)) return

  activeElement.blur()
}

function clearSelectionIfInsideEditor(
  selection: Selection | null,
  containers: HTMLElement[],
): void {
  if (!selection) return

  const hasEditorAnchor = isNodeInsideEditor(selection.anchorNode, containers)
  const hasEditorFocus = isNodeInsideEditor(selection.focusNode, containers)
  if (!hasEditorAnchor && !hasEditorFocus) return

  selection.removeAllRanges()
}

function blurEditorEditableElements(): void {
  for (const editable of document.querySelectorAll<HTMLElement>(EDITOR_EDITABLE_SELECTOR)) {
    editable.blur()
  }
}

export function clearEditorDomSelection(): void {
  if (typeof document === 'undefined') return
  const containers = getEditorContainers()
  if (containers.length === 0) return

  blurActiveEditorElement(containers)
  clearSelectionIfInsideEditor(window.getSelection(), containers)
  blurEditorEditableElements()
}
