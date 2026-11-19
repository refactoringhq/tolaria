import type { VaultEntry } from '../../../types'
import { cardDisplayProperties } from '../kanbanModel'

/** Height of a day's number row, above the item lanes. */
export const DAY_HEADER_PX = 30
export const LANE_GAP_PX = 3
const TITLE_LANE_PX = 22
const FIELDS_LANE_PX = 40
/** Lanes per row before the grid has been measured (tests, first paint). */
const FALLBACK_LANES = 4

interface CardFieldSource {
  cardProperties: string[]
  typeEntryMap: Record<string, VaultEntry>
  displayPropsOverride?: string[] | null
}

export function hasCardFields(entry: VaultEntry, source: CardFieldSource): boolean {
  return cardDisplayProperties(entry, source.cardProperties, source.typeEntryMap, source.displayPropsOverride).length > 0
}

/** Every lane in a calendar is one height, taller when any shown item has card fields under its title. */
export function laneHeightFor(hasFields: boolean): number {
  return hasFields ? FIELDS_LANE_PX : TITLE_LANE_PX
}

/** How many item lanes fit in one week row of the measured grid. */
export function lanesThatFit(gridHeight: number, rows: number, laneHeight: number): number {
  if (gridHeight <= 0) return FALLBACK_LANES
  const rowHeight = gridHeight / rows
  return Math.max(1, Math.floor((rowHeight - DAY_HEADER_PX - 4) / (laneHeight + LANE_GAP_PX)))
}
