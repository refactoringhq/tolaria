import { StateEffect, StateField, type Extension } from '@codemirror/state'
import { Decoration, type DecorationSet, EditorView } from '@codemirror/view'

export interface EditorFindHighlight {
  from: number
  to: number
}

export const setEditorFindHighlight = StateEffect.define<EditorFindHighlight | null>()

const findLineDecoration = Decoration.line({
  attributes: { class: 'cm-editor-find-line' },
})
const findMatchDecoration = Decoration.mark({
  class: 'cm-editor-find-match',
})

function buildFindDecorations(
  state: EditorView['state'],
  match: EditorFindHighlight | null,
): DecorationSet {
  if (!match || match.from < 0 || match.from >= match.to || match.to > state.doc.length) {
    return Decoration.none
  }

  const line = state.doc.lineAt(match.from)
  return Decoration.set([
    findLineDecoration.range(line.from),
    findMatchDecoration.range(match.from, match.to),
  ], true)
}

const editorFindHighlightField = StateField.define<DecorationSet>({
  create: () => Decoration.none,
  update(decorations, transaction) {
    const highlightEffect = transaction.effects.find(effect => effect.is(setEditorFindHighlight))
    if (highlightEffect) return buildFindDecorations(transaction.state, highlightEffect.value)
    return decorations.map(transaction.changes)
  },
  provide: field => EditorView.decorations.from(field),
})

const editorFindHighlightTheme = EditorView.baseTheme({
  '.cm-line.cm-editor-find-line': {
    backgroundColor: 'color-mix(in srgb, var(--accent-yellow) 18%, transparent)',
  },
  '.cm-editor-find-match': {
    backgroundColor: 'var(--accent-yellow)',
    borderRadius: '2px',
    boxShadow: 'inset 0 0 0 1px var(--feedback-warning-border)',
    color: 'light-dark(var(--text-primary), var(--text-inverse))',
  },
})

export const editorFindHighlightExtension: Extension = [
  editorFindHighlightField,
  editorFindHighlightTheme,
]
