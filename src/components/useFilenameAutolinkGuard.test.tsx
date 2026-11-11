import { render } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { shouldStripAutoLinkedLocalFileMarkMock } = vi.hoisted(() => ({
  shouldStripAutoLinkedLocalFileMarkMock: vi.fn(),
}))

vi.mock('../utils/editorLinkAutolink', () => ({
  shouldStripAutoLinkedLocalFileMark: shouldStripAutoLinkedLocalFileMarkMock,
}))

import { useFilenameAutolinkGuard } from './useFilenameAutolinkGuard'

function Harness({ editor }: { editor: unknown }) {
  useFilenameAutolinkGuard(editor as never)
  return null
}

function createEditor({
  nodes,
  docChanged = true,
}: {
  nodes: Array<{ node: unknown; pos: number }>
  docChanged?: boolean
}) {
  let updateHandler: ((payload: { transaction: { docChanged?: boolean; getMeta: (key: string) => unknown } }) => void) | undefined
  const removeMark = vi.fn()
  const setMeta = vi.fn()
  const dispatch = vi.fn()
  const descendants = vi.fn((callback: (node: unknown, pos: number) => void) => {
    for (const entry of nodes) {
      callback(entry.node, entry.pos)
    }
  })

  const tr = {
    docChanged,
    removeMark,
    setMeta,
  }

  const tiptap = {
    schema: {
      marks: {
        link: 'link-mark',
      },
    },
    state: {
      doc: { descendants },
      tr,
    },
    on: vi.fn((event: string, handler: typeof updateHandler) => {
      if (event === 'update') {
        updateHandler = handler
      }
    }),
    off: vi.fn(),
    view: {
      dispatch,
    },
  }

  return {
    editor: {
      _tiptapEditor: tiptap,
    },
    tiptap,
    tr,
    descendants,
    dispatch,
    getUpdateHandler: () => updateHandler,
  }
}

describe('useFilenameAutolinkGuard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('removes accidental filename link marks and tags the transaction to avoid loops', () => {
    shouldStripAutoLinkedLocalFileMarkMock.mockReturnValue(true)
    const fixture = createEditor({
      nodes: [{
        node: {
          isText: true,
          nodeSize: 8,
          text: 'draft.md',
          marks: [{
            type: 'link-mark',
            attrs: { href: 'draft.md' },
          }],
        },
        pos: 4,
      }],
    })

    const { unmount } = render(<Harness editor={fixture.editor} />)
    const updateHandler = fixture.getUpdateHandler()

    expect(updateHandler).toBeTypeOf('function')

    updateHandler?.({
      transaction: {
        docChanged: true,
        getMeta: vi.fn(() => undefined),
      },
    })

    expect(fixture.descendants).toHaveBeenCalledTimes(1)
    expect(fixture.tr.removeMark).toHaveBeenCalledWith(4, 12, 'link-mark')
    expect(fixture.tr.setMeta).toHaveBeenCalledWith('addToHistory', false)
    expect(fixture.tr.setMeta).toHaveBeenCalledWith('tolaria-filename-autolink-guard', true)
    expect(fixture.dispatch).toHaveBeenCalledWith(fixture.tr)

    unmount()

    expect(fixture.tiptap.off).toHaveBeenCalledWith('update', updateHandler)
  })

  it('skips guard runs that are already tagged or have no document changes', () => {
    const fixture = createEditor({ nodes: [] })

    render(<Harness editor={fixture.editor} />)
    const updateHandler = fixture.getUpdateHandler()

    updateHandler?.({
      transaction: {
        docChanged: false,
        getMeta: vi.fn(() => undefined),
      },
    })
    updateHandler?.({
      transaction: {
        docChanged: true,
        getMeta: vi.fn(() => true),
      },
    })

    expect(fixture.descendants).not.toHaveBeenCalled()
    expect(fixture.dispatch).not.toHaveBeenCalled()
  })

  it('does not dispatch when the stripped ranges leave the document unchanged', () => {
    shouldStripAutoLinkedLocalFileMarkMock.mockReturnValue(true)
    const fixture = createEditor({
      docChanged: false,
      nodes: [{
        node: {
          isText: true,
          nodeSize: 8,
          text: 'draft.md',
          marks: [{
            type: 'link-mark',
            attrs: { href: 'draft.md' },
          }],
        },
        pos: 10,
      }],
    })

    render(<Harness editor={fixture.editor} />)
    const updateHandler = fixture.getUpdateHandler()

    updateHandler?.({
      transaction: {
        docChanged: true,
        getMeta: vi.fn(() => undefined),
      },
    })

    expect(fixture.tr.removeMark).toHaveBeenCalledWith(10, 18, 'link-mark')
    expect(fixture.tr.setMeta).not.toHaveBeenCalled()
    expect(fixture.dispatch).not.toHaveBeenCalled()
  })
})
