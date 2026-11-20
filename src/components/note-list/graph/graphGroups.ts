import type { GraphColorGroup } from '../../../collections/collectionTypes'
import { ACCENT_COLOR_PICKER_KEYS } from '../../../utils/typeColors'

/** The group list with the group at `index` changed. */
export function replaced(groups: readonly GraphColorGroup[], index: number, patch: Partial<GraphColorGroup>): GraphColorGroup[] {
  return groups.map((group, position) => (position === index ? { ...group, ...patch } : group))
}

/** The group list with the group at `index` moved one place up (-1) or down (+1). */
export function movedGroup(groups: readonly GraphColorGroup[], index: number, offset: -1 | 1): GraphColorGroup[] {
  const target = index + offset
  if (target < 0 || target >= groups.length) return [...groups]
  const next = [...groups]
  const [moved] = next.splice(index, 1)
  next.splice(target, 0, moved)
  return next
}

/** A new group takes the first palette color no other group uses yet. */
export function newGroup(groups: readonly GraphColorGroup[]): GraphColorGroup {
  const used = new Set(groups.map((group) => group.color))
  const color = ACCENT_COLOR_PICKER_KEYS.find((key) => !used.has(key)) ?? ACCENT_COLOR_PICKER_KEYS[0] ?? 'blue'
  return { id: `group-${Date.now().toString(36)}-${groups.length}`, query: '', color }
}
