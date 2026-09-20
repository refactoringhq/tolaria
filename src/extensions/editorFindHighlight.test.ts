import { EditorState } from '@codemirror/state'
import { EditorView } from '@codemirror/view'
import { afterEach, describe, expect, it } from 'vitest'
import {
  editorFindHighlightExtension,
  setEditorFindHighlight,
} from './editorFindHighlight'

const mountedViews: EditorView[] = []

function createView(doc = 'First line\nAlpha beta\nLast line'): EditorView {
  const parent = document.createElement('div')
  document.body.appendChild(parent)
  const view = new EditorView({
    parent,
    state: EditorState.create({ doc, extensions: [editorFindHighlightExtension] }),
  })
  mountedViews.push(view)
  return view
}

afterEach(() => {
  for (const view of mountedViews.splice(0)) {
    view.dom.parentElement?.remove()
    view.destroy()
  }
})

describe('editorFindHighlightExtension', () => {
  it('decorates the active match and its containing line', () => {
    const view = createView()

    view.dispatch({ effects: setEditorFindHighlight.of({ from: 11, to: 16 }) })

    expect(view.dom.querySelector('.cm-editor-find-line')?.textContent).toContain('Alpha beta')
    expect(view.dom.querySelector('.cm-editor-find-match')?.textContent).toBe('Alpha')
  })

  it('clears both decorations when there is no active match', () => {
    const view = createView()
    view.dispatch({ effects: setEditorFindHighlight.of({ from: 11, to: 16 }) })

    view.dispatch({ effects: setEditorFindHighlight.of(null) })

    expect(view.dom.querySelector('.cm-editor-find-line')).toBeNull()
    expect(view.dom.querySelector('.cm-editor-find-match')).toBeNull()
  })

  it('ignores empty and out-of-range matches', () => {
    const view = createView('Alpha')

    view.dispatch({ effects: setEditorFindHighlight.of({ from: 2, to: 2 }) })
    view.dispatch({ effects: setEditorFindHighlight.of({ from: 0, to: 20 }) })

    expect(view.dom.querySelector('.cm-editor-find-line')).toBeNull()
    expect(view.dom.querySelector('.cm-editor-find-match')).toBeNull()
  })
})
