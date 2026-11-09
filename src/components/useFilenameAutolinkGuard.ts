import { useEffect } from 'react'
import type { useCreateBlockNote } from '@blocknote/react'
import { shouldStripAutoLinkedLocalFileMark } from '../utils/editorLinkAutolink'

const FILENAME_AUTOLINK_GUARD_META = 'tolaria-filename-autolink-guard'

type TiptapLinkMark = {
  attrs?: {
    href?: string
  }
  type: unknown
}

type TiptapTextNode = {
  isText?: boolean
  marks?: TiptapLinkMark[]
  nodeSize: number
  text?: string | null
}

function hasTextContent(node: TiptapTextNode) {
  return Boolean(node.isText && node.text && node.marks?.length)
}

function isAccidentalFilenameLinkMark(
  mark: TiptapLinkMark,
  linkMarkType: unknown,
  text: string,
) {
  if (mark.type !== linkMarkType) {
    return false
  }

  if (typeof mark.attrs?.href !== 'string') {
    return false
  }

  return shouldStripAutoLinkedLocalFileMark({
    href: { raw: mark.attrs.href },
    text: { raw: text },
  })
}

function hasEditorEventApi(
  tiptap: ReturnType<typeof useCreateBlockNote>['_tiptapEditor'] | undefined,
) {
  return Boolean(tiptap && typeof tiptap.on === 'function' && typeof tiptap.off === 'function')
}

function collectAccidentalFilenameLinkRanges(editor: ReturnType<typeof useCreateBlockNote>) {
  const linkMarkType = editor._tiptapEditor?.schema?.marks?.link
  if (!linkMarkType) {
    return []
  }

  const ranges: Array<{ from: number; to: number }> = []
  editor._tiptapEditor.state.doc.descendants((node: TiptapTextNode, pos: number) => {
    if (!hasTextContent(node)) {
      return
    }

    const hasAccidentalFilenameLink = node.marks?.some((mark) => (
      isAccidentalFilenameLinkMark(mark, linkMarkType, node.text ?? '')
    )) ?? false

    if (hasAccidentalFilenameLink) {
      ranges.push({ from: pos, to: pos + node.nodeSize })
    }
  })

  return ranges
}

function shouldSkipGuardRun(
  applyingGuard: boolean,
  transaction: { docChanged?: boolean; getMeta: (key: string) => unknown },
) {
  return (
    applyingGuard
    || !transaction.docChanged
    || transaction.getMeta(FILENAME_AUTOLINK_GUARD_META)
  )
}

function removeLinkRanges(
  editor: ReturnType<typeof useCreateBlockNote>,
  ranges: Array<{ from: number; to: number }>,
) {
  const tr = editor._tiptapEditor.state.tr
  for (const range of ranges) {
    tr.removeMark(range.from, range.to, editor._tiptapEditor.schema.marks.link)
  }

  return tr
}

export function useFilenameAutolinkGuard(editor: ReturnType<typeof useCreateBlockNote>) {
  useEffect(() => {
    const tiptap = editor._tiptapEditor
    if (!hasEditorEventApi(tiptap)) {
      return
    }

    let applyingGuard = false
    const stripAccidentalFilenameAutolinks = ({ transaction }: { transaction: { docChanged?: boolean; getMeta: (key: string) => unknown } }) => {
      if (shouldSkipGuardRun(applyingGuard, transaction)) {
        return
      }

      const ranges = collectAccidentalFilenameLinkRanges(editor)
      if (ranges.length === 0) {
        return
      }

      const tr = removeLinkRanges(editor, ranges)
      if (!tr.docChanged) {
        return
      }

      tr.setMeta(FILENAME_AUTOLINK_GUARD_META, true)
      tr.setMeta('addToHistory', false)
      applyingGuard = true
      tiptap.view.dispatch(tr)
      applyingGuard = false
    }

    tiptap.on('update', stripAccidentalFilenameAutolinks)

    return () => {
      tiptap.off('update', stripAccidentalFilenameAutolinks)
    }
  }, [editor])
}
