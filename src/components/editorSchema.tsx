/* eslint-disable react-refresh/only-export-components -- module-level schema, not a component file */
import { BlockNoteSchema, defaultInlineContentSpecs } from '@blocknote/core'
import { createReactInlineContentSpec } from '@blocknote/react'
import { resolveWikilinkColor as resolveColor } from '../utils/wikilinkColors'
import { resolveEntry } from '../utils/wikilink'
import type { VaultEntry } from '../types'
import { isEmoji } from '../utils/emoji'

// Module-level cache so the WikiLink renderer (defined outside React) can access entries
export const _wikilinkEntriesRef: { current: VaultEntry[] } = { current: [] }

function resolveWikilinkColor(target: string) {
  return resolveColor(_wikilinkEntriesRef.current, target)
}

/** Resolve the display text and optional emoji for a wikilink target.
 *  Priority: pipe display text → entry title → humanised path stem */
function resolveDisplayInfo(target: string): { text: string; emoji: string | null } {
  const pipeIdx = target.indexOf('|')
  if (pipeIdx !== -1) {
    const entry = resolveEntry(_wikilinkEntriesRef.current, target.slice(0, pipeIdx))
    const emoji = entry?.icon && isEmoji(entry.icon) ? entry.icon : null
    return { text: target.slice(pipeIdx + 1), emoji }
  }
  const entry = resolveEntry(_wikilinkEntriesRef.current, target)
  if (entry) {
    const emoji = entry.icon && isEmoji(entry.icon) ? entry.icon : null
    return { text: entry.title, emoji }
  }
  const last = target.split('/').pop() ?? target
  return { text: last.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase()), emoji: null }
}

export const WikiLink = createReactInlineContentSpec(
  {
    type: "wikilink" as const,
    propSchema: {
      target: { default: "" },
    },
    content: "none",
  },
  {
    render: (props) => {
      const target = props.inlineContent.props.target
      const { color, isBroken } = resolveWikilinkColor(target)
      const { text, emoji } = resolveDisplayInfo(target)
      return (
        <span
          className={`wikilink${isBroken ? ' wikilink--broken' : ''}`}
          data-target={target}
          style={{ color }}
        >
          {emoji && <span className="wikilink-emoji">{emoji}{' '}</span>}
          {text}
        </span>
      )
    },
  }
)

export const schema = BlockNoteSchema.create({
  inlineContentSpecs: {
    ...defaultInlineContentSpecs,
    wikilink: WikiLink,
  },
})
