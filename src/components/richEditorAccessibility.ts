const RICH_EDITOR_TEXTBOX_SELECTOR = '.bn-editor[contenteditable="true"][role="textbox"]'

function isElement(node: ParentNode): node is Element {
  return typeof Element !== 'undefined' && node instanceof Element
}

function exposeMultilineTextboxes(root: ParentNode): void {
  if (isElement(root) && root.matches(RICH_EDITOR_TEXTBOX_SELECTOR)) {
    root.setAttribute('aria-multiline', 'true')
  }

  root.querySelectorAll(RICH_EDITOR_TEXTBOX_SELECTOR).forEach((editor) => {
    editor.setAttribute('aria-multiline', 'true')
  })
}

export function observeRichEditorAccessibility(root: ParentNode): () => void {
  exposeMultilineTextboxes(root)

  if (typeof MutationObserver === 'undefined') return () => {}

  const observer = new MutationObserver(() => exposeMultilineTextboxes(root))
  observer.observe(root, {
    attributeFilter: ['class', 'contenteditable', 'role'],
    attributes: true,
    childList: true,
    subtree: true,
  })

  return () => observer.disconnect()
}
