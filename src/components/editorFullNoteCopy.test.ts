import { BlockNoteEditor } from '@blocknote/core'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { schema } from './editorSchema'
import {
  copyFullNoteToClipboard,
  fullNoteClipboardPayload,
  writeFullNoteClipboard,
} from './editorFullNoteCopy'

function createMountedEditor(initialContent: Parameters<typeof BlockNoteEditor.create>[0]['initialContent']) {
  const mount = globalThis.document.createElement('div')
  globalThis.document.body.appendChild(mount)
  const editor = BlockNoteEditor.create({ schema, initialContent })
  editor.mount(mount)

  return {
    editor,
    cleanup: () => {
      editor.unmount()
      mount.remove()
    },
  }
}

const WIKILINK_NOTE_CONTENT = [{
  type: 'paragraph',
  content: [
    { type: 'text', text: 'See ', styles: {} },
    { type: 'wikilink', props: { target: 'Project Alpha' } },
  ],
}]

describe('fullNoteClipboardPayload', () => {
  it('exports full-note html and markdown with wikilink literals', () => {
    const { cleanup, editor } = createMountedEditor(WIKILINK_NOTE_CONTENT)

    try {
      const payloadHtml = fullNoteClipboardPayload(editor)

      expect(payloadHtml).not.toBeNull()
      expect(payloadHtml?.markdown).toContain('[[Project Alpha]]')
      expect(payloadHtml?.html).toContain('See [[Project Alpha]]')
      expect(payloadHtml?.html).not.toContain('data-target')
    } finally {
      cleanup()
    }
  })

  it('keeps tables and styles in the external html payload', () => {
    const { cleanup, editor } = createMountedEditor([
      {
        type: 'table',
        content: {
          type: 'tableContent',
          rows: [
            { cells: ['Name', 'Status'] },
            { cells: ['Copy', 'Rich'] },
          ],
        },
      },
      {
        type: 'bulletListItem',
        content: [{ type: 'text', text: 'Bold bullet', styles: { bold: true } }],
      },
    ])

    try {
      const payloadHtml = fullNoteClipboardPayload(editor)

      expect(payloadHtml?.html).toContain('<table>')
      expect(payloadHtml?.html).toContain('<strong>')
      expect(payloadHtml?.markdown).toContain('**Bold bullet**')
    } finally {
      cleanup()
    }
  })

  it('returns null for an empty note', () => {
    const { cleanup, editor } = createMountedEditor([{ type: 'paragraph', content: [] }])

    try {
      expect(fullNoteClipboardPayload(editor)).toBeNull()
    } finally {
      cleanup()
    }
  })
})

describe('writeFullNoteClipboard', () => {
  const payload = {
    html: '<p><strong>Bold</strong> [[project-alpha]]</p>',
    markdown: '**Bold** [[project-alpha]]\n',
  }

  type MockClipboardRecord = Record<string, string>

  function stubClipboardItem(): void {
    Object.defineProperty(globalThis, 'ClipboardItem', {
      configurable: true,
      value: class {
        constructor(public items: MockClipboardRecord) {}
        get types(): string[] {
          return Object.keys(this.items)
        }
      },
    })
  }

  function stubNavigatorClipboard(mock: Record<string, unknown>): void {
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: mock,
    })
  }

  function restoreClipboardStubs(): void {
    Reflect.deleteProperty(globalThis, 'ClipboardItem')
    Reflect.deleteProperty(navigator, 'clipboard')
  }

  beforeEach(() => {
    restoreClipboardStubs()
  })

  afterEach(() => {
    restoreClipboardStubs()
  })

  it('writes html and plain-text flavors through the web clipboard', async () => {
    stubClipboardItem()
    const writeItems = vi.fn(async () => undefined)
    stubNavigatorClipboard({ write: writeItems })

    const mode = await writeFullNoteClipboard(payload)

    expect(mode).toBe('rich')
    expect(writeItems).toHaveBeenCalledTimes(1)
    const written = writeItems.mock.calls[0][0][0] as {
      types: string[]
      items: MockClipboardRecord
    }
    expect(written.types).toContain('text/html')
    expect(written.items['text/html']).toBe(payload.html)
    expect(written.items['text/plain']).toBe(payload.markdown)
  })

  it('falls back to text clipboard when rich writes are rejected', async () => {
    stubClipboardItem()
    const writeText = vi.fn(async () => undefined)
    stubNavigatorClipboard({
      write: vi.fn(async () => {
        throw new Error('not allowed')
      }),
      writeText,
    })

    const mode = await writeFullNoteClipboard(payload)

    expect(mode).toBe('text')
    expect(writeText).toHaveBeenCalledWith(payload.markdown)
  })

  it('uses the text path when ClipboardItem is unavailable', async () => {
    Object.defineProperty(globalThis, 'ClipboardItem', { configurable: true, value: undefined })
    const writeText = vi.fn(async () => undefined)
    stubNavigatorClipboard({ writeText })

    const mode = await writeFullNoteClipboard(payload)

    expect(mode).toBe('text')
    expect(writeText).toHaveBeenCalledWith(payload.markdown)
  })
})

describe('copyFullNoteToClipboard', () => {
  it('reports failure for an empty note without touching the clipboard', async () => {
    const { cleanup, editor } = createMountedEditor([{ type: 'paragraph', content: [] }])
    Object.defineProperty(globalThis, 'ClipboardItem', {
      configurable: true,
      value: class {
        constructor(public items: Record<string, string>) {}
      },
    })
    const writeItems = vi.fn(async () => undefined)
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { write: writeItems },
    })

    try {
      expect(await copyFullNoteToClipboard(editor)).toBe(false)
      expect(writeItems).not.toHaveBeenCalled()
    } finally {
      cleanup()
      Reflect.deleteProperty(globalThis, 'ClipboardItem')
      Reflect.deleteProperty(navigator, 'clipboard')
    }
  })
})
