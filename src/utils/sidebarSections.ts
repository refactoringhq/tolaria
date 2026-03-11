/**
 * Pure functions for building sidebar section groups from vault entries.
 * Extracted from Sidebar.tsx for testability.
 */

import type { VaultEntry } from '../types'
import type { SectionGroup } from '../components/SidebarParts'
import { resolveIcon } from './iconRegistry'
import { pluralizeType } from '../hooks/useCommandRegistry'
import {
  Wrench, Flask, Target, ArrowsClockwise,
  Users, CalendarBlank, Tag, StackSimple,
} from '@phosphor-icons/react'

const BUILT_IN_SECTION_GROUPS: SectionGroup[] = [
  { label: 'Projects', type: 'Project', Icon: Wrench },
  { label: 'Experiments', type: 'Experiment', Icon: Flask },
  { label: 'Responsibilities', type: 'Responsibility', Icon: Target },
  { label: 'Procedures', type: 'Procedure', Icon: ArrowsClockwise },
  { label: 'People', type: 'Person', Icon: Users },
  { label: 'Events', type: 'Event', Icon: CalendarBlank },
  { label: 'Topics', type: 'Topic', Icon: Tag },
  { label: 'Types', type: 'Type', Icon: StackSimple },
]

/** Metadata lookup for well-known types (icon/label only — NOT used to determine which sections to show) */
const BUILT_IN_TYPE_MAP = new Map(BUILT_IN_SECTION_GROUPS.map((sg) => [sg.type, sg]))

/** Collect unique isA values from active (non-trashed, non-archived) entries, excluding generic Note */
export function collectActiveTypes(entries: VaultEntry[]): Set<string> {
  const types = new Set<string>()
  for (const e of entries) {
    if (e.isA && e.isA !== 'Note' && !e.trashed && !e.archived) types.add(e.isA)
  }
  return types
}

/** Build a single SectionGroup for a type, using built-in metadata or Type entry for icon/label */
export function buildSectionGroup(type: string, typeEntryMap: Record<string, VaultEntry>): SectionGroup {
  const builtIn = BUILT_IN_TYPE_MAP.get(type)
  const typeEntry = typeEntryMap[type]
  const customColor = typeEntry?.color ?? null
  const label = typeEntry?.sidebarLabel || (builtIn?.label ?? pluralizeType(type))
  if (builtIn) {
    const Icon = typeEntry?.icon ? resolveIcon(typeEntry.icon) : builtIn.Icon
    return { ...builtIn, label, Icon, customColor }
  }
  return { label, type, Icon: resolveIcon(typeEntry?.icon ?? null), customColor }
}

/** Build sections dynamically from actual vault entries — only types with ≥1 active note appear */
export function buildDynamicSections(entries: VaultEntry[], typeEntryMap: Record<string, VaultEntry>): SectionGroup[] {
  const activeTypes = collectActiveTypes(entries)
  return Array.from(activeTypes, (type) => buildSectionGroup(type, typeEntryMap))
}

export function sortSections(groups: SectionGroup[], typeEntryMap: Record<string, VaultEntry>): SectionGroup[] {
  return [...groups].sort((a, b) => {
    const orderA = typeEntryMap[a.type]?.order ?? Infinity
    const orderB = typeEntryMap[b.type]?.order ?? Infinity
    return orderA !== orderB ? orderA - orderB : a.label.localeCompare(b.label)
  })
}

export { BUILT_IN_SECTION_GROUPS }
