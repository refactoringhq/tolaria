/* eslint-disable react-refresh/only-export-components -- module-level schema, not a component file */
import { BlockNoteSchema, defaultInlineContentSpecs } from '@blocknote/core'
import { createReactInlineContentSpec } from '@blocknote/react'
import { resolveWikilinkColor as resolveColor } from '../utils/wikilinkColors'
import type { VaultEntry } from '../types'

// Module-level cache so the WikiLink renderer (defined outside React) can access entries
export const _wikilinkEntriesRef: { current: VaultEntry[] } = { current: [] }

function resolveWikilinkColor(target: string) {
  return resolveColor(_wikilinkEntriesRef.current, target)
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
      return (
        <span
          className={`wikilink${isBroken ? ' wikilink--broken' : ''}`}
          data-target={target}
          style={{ color }}
        >
          {target}
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
