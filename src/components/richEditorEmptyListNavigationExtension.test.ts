import { describe, expect, it, vi } from 'vitest'
import { createRichEditorEmptyListNavigationExtension } from './richEditorEmptyListNavigationExtension'

type KeyListener = (event: KeyboardEvent) => void

type NavigationKey = 'ArrowDown' | 'ArrowUp' | 'Backspace'

function keyboardEvent(key: NavigationKey, options: Partial<KeyboardEvent> = {}) {
  return {
    altKey: false,
    ctrlKey: false,
    isComposing: false,
    key,
    keyCode: key === 'ArrowDown' ? 40 : key === 'ArrowUp' ? 38 : 8,
    metaKey: false,
    preventDefault: vi.fn(),
    shiftKey: false,
    stopImmediatePropagation: vi.fn(),
    ...options,
  } as unknown as KeyboardEvent & {
    preventDefault: ReturnType<typeof vi.fn>
    stopImmediatePropagation: ReturnType<typeof vi.fn>
  }
}

function createFixture({
  atVisualEdge = true,
  editable = true,
  nextContent = [],
  nextType = 'bulletListItem',
  previousContent = [],
  previousType = 'bulletListItem',
  selectionEmpty = true,
} = {}) {
  let keydownListener: KeyListener | null = null
  const nextBlock = { content: nextContent, id: 'next', type: nextType }
  const prevBlock = { content: previousContent, id: 'previous', type: previousType }
  const view = {
    composing: false,
    endOfTextblock: vi.fn(() => atVisualEdge),
    state: { selection: { empty: selectionEmpty } },
  }
  const editor = {
    _tiptapEditor: { view },
    getTextCursorPosition: vi.fn(() => ({
      block: { content: [{ text: 'Current', type: 'text' }], id: 'current', type: 'paragraph' },
      nextBlock,
      prevBlock,
    })),
    isEditable: editable,
    prosemirrorView: view,
    setTextCursorPosition: vi.fn(),
  }
  const dom = {
    addEventListener: vi.fn((type: string, listener: KeyListener) => {
      if (type === 'keydown') keydownListener = listener
    }),
  }
  const extension = createRichEditorEmptyListNavigationExtension()({ editor: editor as never })
  extension.mount?.({
    dom: dom as never,
    root: document,
    signal: new AbortController().signal,
  })

  return {
    editor,
    fire(key: NavigationKey, options: Partial<KeyboardEvent> = {}) {
      if (!keydownListener) throw new Error('Empty-list navigation listener was not registered')
      const event = keyboardEvent(key, options)
      keydownListener(event)
      return event
    },
    nextBlock,
    prevBlock,
    view,
  }
}

interface NestedBackspaceFixtureOptions {
  ancestorDepth: number
  blockType: string
  hasChildren: boolean
  hasSibling: boolean
  listType: string
  nested: boolean
}

const DEFAULT_BACKSPACE_OPTIONS: NestedBackspaceFixtureOptions = {
  ancestorDepth: 1,
  blockType: 'paragraph',
  hasChildren: true,
  hasSibling: true,
  listType: 'bulletListItem',
  nested: true,
}

function createNestedDocument(
  current: Record<string, unknown>,
  options: NestedBackspaceFixtureOptions,
): Record<string, unknown>[] {
  const sibling = { content: [{ text: 'D', type: 'text' }], id: 'sibling', type: options.listType }
  const parent = {
    children: [current, ...(options.hasSibling ? [sibling] : [])],
    content: [{ text: 'A', type: 'text' }],
    id: 'parent',
    type: options.listType,
  }
  if (!options.nested) return [current, parent]

  let root = parent
  for (let level = 1; level < options.ancestorDepth; level += 1) {
    root = {
      children: [root],
      content: [{ text: `Ancestor ${level}`, type: 'text' }],
      id: `ancestor-${level}`,
      type: options.listType,
    }
  }
  return [root]
}

function createNestedBackspaceFixture(partialOptions: Partial<NestedBackspaceFixtureOptions> = {}) {
  const options = { ...DEFAULT_BACKSPACE_OPTIONS, ...partialOptions }
  let keydownListener: KeyListener | null = null
  const child = { content: [{ text: 'C', type: 'text' }], id: 'child', type: options.listType }
  const current = {
    children: options.hasChildren ? [child] : [],
    content: [],
    id: 'current',
    type: options.blockType,
  }
  const view = {
    composing: false,
    endOfTextblock: vi.fn(() => true),
    state: { selection: { empty: true } },
  }
  const editor = {
    _tiptapEditor: { view },
    document: createNestedDocument(current, options),
    getTextCursorPosition: vi.fn(() => ({ block: current })),
    isEditable: true,
    prosemirrorView: view,
    removeBlocks: vi.fn(),
  }
  const extension = createRichEditorEmptyListNavigationExtension()({ editor: editor as never })
  extension.mount?.({
    dom: {
      addEventListener: vi.fn((type: string, listener: KeyListener) => {
        if (type === 'keydown') keydownListener = listener
      }),
    } as never,
    root: document,
    signal: new AbortController().signal,
  })

  return {
    current,
    editor,
    fire() {
      if (!keydownListener) throw new Error('Empty-list navigation listener was not registered')
      const event = keyboardEvent('Backspace')
      keydownListener(event)
      return event
    },
    view,
  }
}

describe('createRichEditorEmptyListNavigationExtension', () => {
  it('moves through an adjacent empty list item at the visual block edge', () => {
    const down = createFixture()
    const downEvent = down.fire('ArrowDown')
    expect(down.view.endOfTextblock).toHaveBeenCalledWith('down')
    expect(down.editor.setTextCursorPosition).toHaveBeenCalledWith(down.nextBlock, 'start')
    expect(downEvent.preventDefault).toHaveBeenCalled()
    expect(downEvent.stopImmediatePropagation).toHaveBeenCalled()

    const up = createFixture()
    const upEvent = up.fire('ArrowUp')
    expect(up.view.endOfTextblock).toHaveBeenCalledWith('up')
    expect(up.editor.setTextCursorPosition).toHaveBeenCalledWith(up.prevBlock, 'end')
    expect(upEvent.preventDefault).toHaveBeenCalled()
  })

  it('leaves wrapped lines, non-empty neighbors, and ranges alone', () => {
    expect(createFixture({ atVisualEdge: false }).fire('ArrowDown').preventDefault).not.toHaveBeenCalled()
    expect(createFixture({ nextContent: [{ text: 'Next', type: 'text' }] })
      .fire('ArrowDown').preventDefault).not.toHaveBeenCalled()
    expect(createFixture({ selectionEmpty: false }).fire('ArrowDown').preventDefault).not.toHaveBeenCalled()
  })

  it('ignores modified, composing, and read-only arrow keys', () => {
    expect(createFixture().fire('ArrowDown', { shiftKey: true }).preventDefault).not.toHaveBeenCalled()
    expect(createFixture().fire('ArrowDown', { isComposing: true }).preventDefault).not.toHaveBeenCalled()
    expect(createFixture({ editable: false }).fire('ArrowDown').preventDefault).not.toHaveBeenCalled()
  })

  it.each(['bulletListItem', 'numberedListItem'])('preserves %s descendants when their empty parent is backspaced', (listType) => {
    const fixture = createNestedBackspaceFixture({ ancestorDepth: 3, listType })
    const event = fixture.fire()

    expect(fixture.view.endOfTextblock).toHaveBeenCalledWith('backward')
    expect(fixture.editor.removeBlocks).not.toHaveBeenCalled()
    expect(event.preventDefault).toHaveBeenCalledOnce()
    expect(event.stopImmediatePropagation).toHaveBeenCalledOnce()
  })

  it.each([true, false])('removes only a childless nested paragraph when sibling presence is %s', (hasSibling) => {
    const fixture = createNestedBackspaceFixture({ hasChildren: false, hasSibling })
    const event = fixture.fire()

    expect(fixture.editor.removeBlocks).toHaveBeenCalledWith([fixture.current])
    expect(event.preventDefault).toHaveBeenCalledOnce()
  })

  it('leaves root paragraphs and empty list-item marker removal to BlockNote', () => {
    const rootParagraph = createNestedBackspaceFixture({ nested: false })
    const listItem = createNestedBackspaceFixture({ blockType: 'bulletListItem' })

    expect(rootParagraph.fire().preventDefault).not.toHaveBeenCalled()
    expect(listItem.fire().preventDefault).not.toHaveBeenCalled()
  })
})
