import { mobilePropertyDisplay } from './mobilePropertyDisplay'
import type { MobileNote, MobilePropertyDisplayMode, MobilePropertyValue, MobileTone, MobileTypeDefinitions } from './mobileWorkspaceModel'
import { relationshipLookupKeys } from '../../../../src/utils/relationshipKeys'

export type MobileTagTone = 'blue' | 'green' | 'orange' | 'purple' | 'red'
type DisplayPropertyKey = string
type DisplayModeOverrides = Record<string, MobilePropertyDisplayMode>
type NormalizedDisplayPropertyKey = string
type StatusLabel = string
type TagLabel = string

export type MobileNoteDisplayChip = {
  label: string
  tone: MobileTone
}

export function mobileNoteRowChips(
  note: MobileNote,
  keys: DisplayPropertyKey[] = [],
  typeDefinitions?: MobileTypeDefinitions,
  displayModes?: DisplayModeOverrides | null,
): MobileNoteDisplayChip[] {
  return configuredMobileNoteRowChips(note, displayPropertyKeysForNote(note, keys, typeDefinitions), displayModes)
}

export function configuredMobileNoteRowChips(
  note: MobileNote,
  keys: DisplayPropertyKey[],
  displayModes?: DisplayModeOverrides | null,
): MobileNoteDisplayChip[] {
  return keys.flatMap((key) => displayPropertyChips(note, key, displayModes))
}

export function mobileNoteDisplayLabels(
  note: MobileNote,
  keys: DisplayPropertyKey[] = [],
  typeDefinitions?: MobileTypeDefinitions,
  displayModes?: DisplayModeOverrides | null,
): string[] {
  return mobileNoteRowChips(note, keys, typeDefinitions, displayModes).map((chip) => chip.label)
}

function displayPropertyKeysForNote(
  note: MobileNote,
  keys: DisplayPropertyKey[],
  typeDefinitions: MobileTypeDefinitions | undefined,
) {
  return keys.length > 0 ? keys : typeDefinitions?.[note.type]?.listPropertiesDisplay ?? []
}

export function chipTone(tone: MobileTone) {
  return tone
}

export function statusTone(status: StatusLabel): 'blue' | 'green' | 'orange' {
  const normalized = status.trim().toLowerCase()
  if (normalized === 'shipped') return 'green'
  if (normalized === 'active') return 'blue'
  return 'orange'
}

export function tagTone(label: TagLabel): MobileTagTone {
  const tones = ['blue', 'green', 'orange', 'purple', 'red'] as const
  const index = Array.from(label).reduce((sum, char) => sum + char.charCodeAt(0), 0) % tones.length

  return tones[index]
}

function displayPropertyChips(
  note: MobileNote,
  key: DisplayPropertyKey,
  displayModes?: DisplayModeOverrides | null,
): MobileNoteDisplayChip[] {
  const normalizedKey = key.trim().toLowerCase()
  if (!normalizedKey) return []
  if (isTypePropertyKey(normalizedKey)) return [{ label: note.type, tone: chipTone(note.typeTone) }]
  if (normalizedKey === 'status') return note.status ? [{ label: note.status, tone: statusTone(note.status) }] : []
  if (normalizedKey === 'tags') return note.tags.map((tag) => ({ label: tag, tone: tagTone(tag) }))

  return relationshipChips(note, normalizedKey) ?? propertyChips(note, normalizedKey, displayModes)
}

function isTypePropertyKey(normalizedKey: NormalizedDisplayPropertyKey) {
  return ['type', 'isa', 'is_a'].includes(normalizedKey)
}

function relationshipChips(note: MobileNote, normalizedKey: NormalizedDisplayPropertyKey): MobileNoteDisplayChip[] | null {
  const relationship = note.relationships.find((candidate) => relationshipLookupKeys(candidate).includes(normalizedKey))
  if (!relationship) return null

  return relationship.values.map((value) => ({ label: value.title, tone: chipTone(value.typeTone) }))
}

function propertyChips(
  note: MobileNote,
  normalizedKey: NormalizedDisplayPropertyKey,
  displayModes?: DisplayModeOverrides | null,
): MobileNoteDisplayChip[] {
  const property = note.properties?.find((candidate) => candidate.key.toLowerCase() === normalizedKey)
  if (!property) return []

  const values = Array.isArray(property.value) ? property.value : [property.value]
  return values
    .map((value) => propertyChip(property.key, value, displayModes))
    .filter((chip): chip is MobileNoteDisplayChip => chip !== null)
}

function propertyChip(
  key: DisplayPropertyKey,
  value: MobilePropertyValue,
  displayModes?: DisplayModeOverrides | null,
): MobileNoteDisplayChip | null {
  const display = mobilePropertyDisplay(key, value, { false: 'false', true: 'true' }, displayModes)
  const label = display.kind === 'url' ? urlChipLabel(display.text) : truncateChipLabel(display.text)
  if (!label) return null

  return {
    label,
    tone: display.kind === 'status' ? statusTone(display.text) : propertyChipTone(display.kind),
  }
}

function propertyChipTone(kind: ReturnType<typeof mobilePropertyDisplay>['kind']): MobileTone {
  return kind === 'url' ? 'blue' : 'gray'
}

function urlChipLabel(value: string): string {
  const url = normalizedHttpUrl(value)
  return truncateChipLabel(url?.hostname ?? value)
}

function normalizedHttpUrl(value: string): URL | null {
  const trimmed = value.trim()
  const candidate = /^https?:\/\//iu.test(trimmed) ? trimmed : `https://${trimmed}`

  try {
    const url = new URL(candidate)
    return url.protocol === 'http:' || url.protocol === 'https:' ? url : null
  } catch {
    return null
  }
}

function truncateChipLabel(value: string): string {
  const trimmed = value.trim()
  return trimmed.length > 40 ? `${trimmed.slice(0, 37)}...` : trimmed
}
