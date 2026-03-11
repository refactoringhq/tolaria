/* eslint-disable react-refresh/only-export-components -- module-level schema, not a component file */
import { BlockNoteSchema, defaultInlineContentSpecs } from '@blocknote/core'
import { createReactInlineContentSpec } from '@blocknote/react'
import { resolveWikilinkColor as resolveColor } from '../utils/wikilinkColors'
import { resolveEntry } from '../utils/wikilink'
import type { VaultEntry } from '../types'

// Module-level cache so the WikiLink renderer (defined outside React) can access entries
export const _wikilinkEntriesRef: { current: VaultEntry[] } = { current: [] }

function resolveWikilinkColor(target: string) {
  return resolveColor(_wikilinkEntriesRef.current, target)
}

/** Resolve the display text for a wikilink target.
 *  Priority: pipe display text → entry title → humanised path stem */
function resolveDisplayText(target: string): string {
  const pipeIdx = target.indexOf('|')
  if (pipeIdx !== -1) return target.slice(pipeIdx + 1)
  const entry = resolveEntry(_wikilinkEntriesRef.current, target)
  if (entry) return entry.title
  const last = target.split('/').pop() ?? target
  return last.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
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
      const displayText = resolveDisplayText(target)
      return (
        <span
          className={`wikilink${isBroken ? ' wikilink--broken' : ''}`}
          data-target={target}
          style={{ color }}
        >
          {displayText}
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
