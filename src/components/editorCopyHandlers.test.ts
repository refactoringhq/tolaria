import { BlockNoteEditor } from '@blocknote/core'
import { CellSelection } from '@tiptap/pm/tables'
import { describe, expect, it } from 'vitest'
import { handleEditorCopy } from './editorCopyHandlers'
import { schema } from './editorSchema'

function createMountedEditor() {
  const mount = document.createElement('div')
  document.body.appendChild(mount)
  const editor = BlockNoteEditor.create({
    schema,
    initialContent: [
      {
        type: 'table',
        content: {
          type: 'tableContent',
          rows: [
            { cells: ['A1', 'B1', 'C1'] },
            { cells: ['A2', 'B2', 'C2'] },
          ],
        },
      },
    ],
  })
  editor.mount(mount)

  return {
    editor,
    mount,
    cleanup: () => {
      editor.unmount()
      mount.remove()
      window.getSelection()?.removeAllRanges()
    },
  }
}

function selectCells(
  editor: ReturnType<typeof createMountedEditor>['editor'],
  scope: 'all' | 'first',
) {
  const cellPositions: number[] = []
  editor.prosemirrorState.doc.descendants((node, pos) => {
    if (node.type.name === 'tableCell' || node.type.name === 'tableHeader') cellPositions.push(pos)
  })

  const view = editor.prosemirrorView
  if (!view) throw new Error('editor view is not mounted')
  const transaction = view.state.tr
  transaction.setSelection(
    CellSelection.create(
      transaction.doc,
      cellPositions[0],
      scope === 'all' ? cellPositions[cellPositions.length - 1] : cellPositions[0],
    ),
  )
  view.dispatch(transaction)
  view.focus()
  return view
}

function createClipboard() {
  const values = new Map<string, string>()
  const data = {
    setData: (type: string, value: string) => { values.set(type, value) },
    getData: (type: string) => values.get(type) ?? '',
    clearData: () => { values.clear() },
  } as unknown as DataTransfer

  return { data, get: (type: string) => values.get(type) ?? '' }
}

describe('handleEditorCopy', () => {
  it('leaves a table cell range to BlockNote so every selected cell is copied', () => {
    const { editor, mount, cleanup } = createMountedEditor()

    try {
      const view = selectCells(editor, 'all')
      const clipboard = createClipboard()
      const event = new Event('copy', { bubbles: true, cancelable: true })
      Object.defineProperty(event, 'clipboardData', { value: clipboard.data })

      handleEditorCopy(
        {
          currentTarget: mount,
          clipboardData: clipboard.data,
          preventDefault: () => event.preventDefault(),
        } as unknown as Parameters<typeof handleEditorCopy>[0],
        editor,
      )
      view.dom.dispatchEvent(event)

      expect(clipboard.get('text/plain')).toContain('A1')
      expect(clipboard.get('text/plain')).toContain('C2')
      expect(clipboard.get('text/html')).toContain('<table>')
    } finally {
      cleanup()
    }
  })

  it('still copies a single cell as plain text', () => {
    const { editor, mount, cleanup } = createMountedEditor()

    try {
      selectCells(editor, 'first')
      const clipboard = createClipboard()
      const event = new Event('copy', { bubbles: true, cancelable: true })
      Object.defineProperty(event, 'clipboardData', { value: clipboard.data })

      handleEditorCopy(
        {
          currentTarget: mount,
          clipboardData: clipboard.data,
          preventDefault: () => event.preventDefault(),
        } as unknown as Parameters<typeof handleEditorCopy>[0],
        editor,
      )

      expect(clipboard.get('text/plain')).toBe('A1')
      expect(event.defaultPrevented).toBe(true)
    } finally {
      cleanup()
    }
  })
})
