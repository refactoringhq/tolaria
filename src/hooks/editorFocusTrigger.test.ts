import { afterEach, describe, expect, it } from 'vitest'
import { requestEditorFocus } from './useEditorFocus'

/**
 * A remote note opens its live document before its editor can take focus. Until then the
 * control that created the note must not keep the keyboard: a space typed into the title
 * pressed "Create new note" again and made a second untitled note (web-gates flake).
 */
describe('requestEditorFocus', () => {
  afterEach(() => {
    document.body.replaceChildren()
  })

  function focusedControl(tagName: string, attributes: Record<string, string> = {}): HTMLElement {
    const control = document.createElement(tagName)
    for (const [name, value] of Object.entries(attributes)) control.setAttribute(name, value)
    document.body.append(control)
    control.focus()
    expect(document.activeElement).toBe(control)
    return control
  }

  it('takes the keyboard from the button that created the note', () => {
    focusedControl('button', { 'aria-label': 'Create new note' })

    requestEditorFocus({ path: 'untitled-note-1.md', selectTitle: true })

    expect(document.activeElement).toBe(document.body)
  })

  it('takes the keyboard from the menu item that created the note', () => {
    focusedControl('div', { role: 'menuitem', tabindex: '-1' })

    requestEditorFocus({ path: 'folder/untitled-note-1.md', selectTitle: true })

    expect(document.activeElement).toBe(document.body)
  })

  it('leaves a text field the user is typing in alone', () => {
    const field = focusedControl('input', { 'aria-label': 'Search notes' })

    requestEditorFocus({ path: 'untitled-note-1.md', selectTitle: true })

    expect(document.activeElement).toBe(field)
  })

  it('leaves focus alone when the request is not for a new note title', () => {
    const button = focusedControl('button', { 'aria-label': 'Bold' })

    requestEditorFocus({})
    requestEditorFocus({ path: 'renamed-note.md' })

    expect(document.activeElement).toBe(button)
  })
})
