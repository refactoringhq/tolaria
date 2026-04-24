import { createExtension } from '@blocknote/core'
import { resolveArrowLigatureInput } from '../utils/arrowLigatures'

const PREFIX_CONTEXT_LENGTH = 2

function isInsertedCharacter(event: InputEvent): event is InputEvent & { data: string } {
  return event.inputType === 'insertText' && typeof event.data === 'string'
}

export const createArrowLigaturesExtension = createExtension(({ editor }) => {
  let literalAsciiCursor: number | null = null

  return {
    key: 'arrowLigatures',
    mount: ({ dom, signal }) => {
      const handleBeforeInput = (event: InputEvent) => {
        if (!isInsertedCharacter(event)) {
          return
        }

        const view = editor._tiptapEditor?.view ?? editor.prosemirrorView
        if (!view) {
          return
        }
        if (event.isComposing || view.composing) {
          return
        }

        const { from, to } = view.state.selection
        if (from !== to) {
          return
        }

        const beforeText = view.state.doc.textBetween(
          Math.max(0, from - PREFIX_CONTEXT_LENGTH),
          from,
          '',
          '',
        )
        const resolution = resolveArrowLigatureInput({
          beforeText,
          cursor: from,
          inputText: event.data,
          literalAsciiCursor,
        })
        literalAsciiCursor = resolution.nextLiteralAsciiCursor

        if (!resolution.change) {
          return
        }

        event.preventDefault()
        view.dispatch(
          view.state.tr.insertText(
            resolution.change.insert,
            resolution.change.from,
            resolution.change.to,
          ),
        )
      }

      dom.addEventListener('beforeinput', handleBeforeInput as EventListener, {
        capture: true,
        signal,
      })
    },
  } as const
})
