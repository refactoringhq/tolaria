import { describe, expect, it } from 'vitest'
import { observeRichEditorAccessibility } from './richEditorAccessibility'

function richEditorElement(): HTMLDivElement {
  const editor = document.createElement('div')
  editor.className = 'bn-editor'
  editor.setAttribute('contenteditable', 'true')
  editor.setAttribute('role', 'textbox')
  editor.innerHTML = '<p>Primer paràgraf.</p><p>Segon paràgraf.</p>'
  return editor
}

describe('observeRichEditorAccessibility', () => {
  it('exposes the BlockNote textbox as multiline for external text tools', () => {
    const container = document.createElement('section')
    const editor = richEditorElement()
    container.append(editor)

    const disconnect = observeRichEditorAccessibility(container)

    expect(editor).toHaveAttribute('aria-multiline', 'true')
    disconnect()
  })

  it('preserves the multiline contract when BlockNote remounts its editable surface', async () => {
    const container = document.createElement('section')
    const disconnect = observeRichEditorAccessibility(container)
    const replacement = richEditorElement()

    container.append(replacement)
    await new Promise(resolve => setTimeout(resolve, 0))

    expect(replacement).toHaveAttribute('aria-multiline', 'true')
    disconnect()
  })

  it('does not describe unrelated contenteditable controls as multiline editors', () => {
    const container = document.createElement('section')
    const inlineControl = document.createElement('span')
    inlineControl.setAttribute('contenteditable', 'true')
    container.append(inlineControl)

    const disconnect = observeRichEditorAccessibility(container)

    expect(inlineControl).not.toHaveAttribute('aria-multiline')
    disconnect()
  })
})
