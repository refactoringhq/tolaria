import { afterEach, describe, expect, it, vi } from 'vitest'
import { TableHandlesView } from '../../node_modules/@blocknote/core/src/extensions/TableHandles/TableHandles'

function createTableBlock() {
  return {
    id: 'table-block',
    type: 'table',
    content: {
      type: 'tableContent',
      rows: [
        { cells: ['Head 1', 'Head 2'] },
        { cells: ['A', 'B'] },
      ],
    },
  }
}

describe('BlockNote table handles regression', () => {
  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('hides stale table handles instead of throwing when tbody is missing during update', () => {
    const block = createTableBlock()
    const editorRoot = document.createElement('div')
    document.body.appendChild(editorRoot)

    const editor = {
      getBlock: vi.fn(() => block),
    }
    const emitUpdate = vi.fn()

    const view = new TableHandlesView(
      editor as never,
      {
        dom: editorRoot,
        root: document,
      } as never,
      emitUpdate,
    )

    view.state = {
      block,
      show: true,
      showAddOrRemoveRowsButton: true,
      showAddOrRemoveColumnsButton: true,
      rowIndex: 0,
      colIndex: 0,
    } as never

    const staleTableWrapper = document.createElement('div')
    editorRoot.appendChild(staleTableWrapper)
    view.tableElement = staleTableWrapper

    expect(() => view.update()).not.toThrow()
    expect(view.state?.show).toBe(false)
    expect(view.state?.showAddOrRemoveRowsButton).toBe(false)
    expect(view.state?.showAddOrRemoveColumnsButton).toBe(false)
    expect(emitUpdate).toHaveBeenCalled()

    view.destroy()
  })
})
