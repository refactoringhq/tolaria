import { describe, expect, it, vi } from 'vitest'
import { createRichEditorEmptyListNavigationExtension } from './richEditorEmptyListNavigationExtension'
import {
  collapsedSectionEndBlock,
  collapsedSectionHiddenBlockIds,
  toggleCollapsedHeading,
} from './tolariaCollapsedSections'

type KeyListener = (event: KeyboardEvent) => void
type NavigationKey = 'ArrowDown' | 'ArrowUp' | 'Backspace' | 'Enter'

function keyboardEvent(key: NavigationKey, options: Partial<KeyboardEvent> = {}) {
  return {
    altKey: false,
    ctrlKey: false,
    isComposing: false,
    key,
    keyCode: key === 'ArrowDown' ? 40 : key === 'ArrowUp' ? 38 : key === 'Enter' ? 13 : 8,
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

describe('createRichEditorEmptyListNavigationExtension', () => {
  it('uses the containing top-level block when the collapsed section ends in nested content', () => {
    const editor = {
      document: [
        { id: 'heading', type: 'heading', props: { level: 1 } },
        {
          children: [{ id: 'nested-end', type: 'paragraph' }],
          id: 'section-parent',
          type: 'bulletListItem',
        },
        { id: 'next-heading', type: 'heading', props: { level: 1 } },
      ],
      onChange: vi.fn(() => vi.fn()),
    }
    const editorElement = document.createElement('div')
    toggleCollapsedHeading(editor as never, 'heading', editorElement)

    expect(collapsedSectionEndBlock(editor as never, 'heading')).toMatchObject({ id: 'section-parent' })
    toggleCollapsedHeading(editor as never, 'heading', editorElement)
  })

  it('uses the final top-level block when a collapsed section ends the document', () => {
    const endBlock = { id: 'last', type: 'paragraph' }
    const editor = {
      document: [
        { id: 'heading', type: 'heading', props: { level: 1 } },
        endBlock,
      ],
      onChange: vi.fn(() => vi.fn()),
    }
    const editorElement = document.createElement('div')
    toggleCollapsedHeading(editor as never, 'heading', editorElement)

    expect(collapsedSectionEndBlock(editor as never, 'heading')).toBe(endBlock)
    toggleCollapsedHeading(editor as never, 'heading', editorElement)
  })

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

  it('inserts after the outer collapsed section when Enter is at a collapsed heading end', () => {
    let keydownListener: KeyListener | null = null
    const heading = { content: [{ text: 'Inner', type: 'text' }], id: 'inner', props: { level: 2 }, type: 'heading' }
    const sectionEnd = { content: [{ text: 'Hidden', type: 'text' }], id: 'body', type: 'paragraph' }
    const next = { content: [], id: 'next', props: { level: 1 }, type: 'heading' }
    const paragraph = { content: [], id: 'inserted', type: 'paragraph' }
    const view = {
      composing: false,
      endOfTextblock: vi.fn(() => true),
      state: { selection: { empty: true, $head: { parentOffset: 5, parent: { content: { size: 5 } } } } },
    }
    const editor = {
      _tiptapEditor: { view },
      document: [
        { content: [{ text: 'Outer', type: 'text' }], id: 'outer', props: { level: 1 }, type: 'heading' },
        heading,
        sectionEnd,
        next,
      ],
      getTextCursorPosition: vi.fn(() => ({ block: heading })),
      insertBlocks: vi.fn((blocks: Array<{ type: 'paragraph' }>, referenceId: string) => {
        const referenceIndex = editor.document.findIndex((block) => block.id === referenceId)
        editor.document.splice(referenceIndex + 1, 0, paragraph)
        return blocks.map(() => paragraph)
      }),
      isEditable: true,
      onChange: vi.fn(() => vi.fn()),
      prosemirrorView: view,
      setTextCursorPosition: vi.fn(),
    }
    const editorElement = document.createElement('div')
    toggleCollapsedHeading(editor as never, 'outer', editorElement)
    toggleCollapsedHeading(editor as never, 'inner', editorElement)
    const extension = createRichEditorEmptyListNavigationExtension()({ editor: editor as never })
    extension.mount?.({
      dom: { addEventListener: vi.fn((_type: string, listener: KeyListener) => { keydownListener = listener }) } as never,
      root: document,
      signal: new AbortController().signal,
    })

    const event = keyboardEvent('Enter')
    keydownListener?.(event)
    expect(editor.insertBlocks).toHaveBeenCalledWith([{ type: 'paragraph' }], 'body', 'after')
    expect(editor.setTextCursorPosition).toHaveBeenCalledWith(paragraph, 'start')
    expect(event.preventDefault).toHaveBeenCalled()
    const hiddenBlockIds = collapsedSectionHiddenBlockIds(editor as never)
    expect(hiddenBlockIds).toContain(sectionEnd.id)
    expect(hiddenBlockIds).not.toContain(paragraph.id)
    toggleCollapsedHeading(editor as never, 'outer', editorElement)
    toggleCollapsedHeading(editor as never, 'inner', editorElement)
  })

  it('promotes linked children when deleting an empty paragraph nested under a list', () => {
    let keydownListener: KeyListener | null = null
    const linkedChild = {
      children: [],
      content: [{
        content: [{ styles: {}, text: 'Tolaria', type: 'text' }],
        href: 'https://tolaria.app',
        type: 'link',
      }],
      id: 'linked-child',
      type: 'bulletListItem',
    }
    const emptyParagraph = {
      children: [linkedChild],
      content: [],
      id: 'empty-parent',
      type: 'paragraph',
    }
    const listParent = {
      children: [emptyParagraph],
      content: [{ styles: {}, text: 'Parent', type: 'text' }],
      id: 'list-parent',
      type: 'bulletListItem',
    }
    const view = {
      composing: false,
      endOfTextblock: vi.fn(() => true),
      state: { selection: { empty: true } },
    }
    const editor = {
      _tiptapEditor: { view },
      document: [listParent],
      getTextCursorPosition: vi.fn(() => ({ block: emptyParagraph })),
      isEditable: true,
      prosemirrorView: view,
      replaceBlocks: vi.fn(),
      setTextCursorPosition: vi.fn(),
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

    const event = keyboardEvent('Backspace')
    if (!keydownListener) throw new Error('Empty-list navigation listener was not registered')
    keydownListener(event)

    expect(editor.replaceBlocks).toHaveBeenCalledWith([emptyParagraph], [linkedChild])
    expect(editor.setTextCursorPosition).toHaveBeenCalledWith(linkedChild, 'start')
    expect(event.preventDefault).toHaveBeenCalledOnce()
    expect(event.stopImmediatePropagation).toHaveBeenCalledOnce()
  })
})
