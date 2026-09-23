import type { VaultEntry } from '../types'
import { resolveNoteIcon } from './noteIcon'
import { lookupColorForEntry } from './wikilinkColors'
import { resolveEntry, wikilinkDisplay, wikilinkTarget } from './wikilink'

const SHEET_WIKILINK_PATTERN = /\[\[([^\]\n]+?)\]\]/g

type RawWikilinkTarget = string

function wikilinkRef(rawTarget: RawWikilinkTarget): string {
  return `[[${rawTarget}]]`
}

function displayTitleForTarget(rawTarget: RawWikilinkTarget, entry: VaultEntry | undefined): string {
  const pipeIndex = rawTarget.indexOf('|')
  if (pipeIndex >= 0) return rawTarget.slice(pipeIndex + 1)
  return entry?.title ?? wikilinkDisplay(wikilinkRef(rawTarget))
}

function displayIconForEntry(entry: VaultEntry | undefined): string {
  const icon = resolveNoteIcon(entry?.icon)
  return icon.kind === 'emoji' ? `${icon.value} ` : ''
}

function resolveTargetEntry(
  entries: VaultEntry[],
  rawTarget: RawWikilinkTarget,
  sourceEntry?: VaultEntry | null,
): VaultEntry | undefined {
  return resolveEntry(entries, wikilinkTarget(wikilinkRef(rawTarget)), sourceEntry ?? undefined)
}

export function sheetCellContainsPlainWikilink(value: string): boolean {
  SHEET_WIKILINK_PATTERN.lastIndex = 0
  return !value.trimStart().startsWith('=') && SHEET_WIKILINK_PATTERN.test(value)
}

export function sheetWikilinkDisplayValue(
  value: string,
  entries: VaultEntry[],
  sourceEntry?: VaultEntry | null,
): string {
  SHEET_WIKILINK_PATTERN.lastIndex = 0
  return value.replace(SHEET_WIKILINK_PATTERN, (_match, rawTarget: string) => {
    const entry = resolveTargetEntry(entries, rawTarget, sourceEntry)
    return `${displayIconForEntry(entry)}${displayTitleForTarget(rawTarget, entry)}`
  })
}

export function firstSheetWikilinkTarget(value: string): RawWikilinkTarget | null {
  SHEET_WIKILINK_PATTERN.lastIndex = 0
  return SHEET_WIKILINK_PATTERN.exec(value)?.[1] ?? null
}

export function sheetWikilinkColor(
  value: string,
  entries: VaultEntry[],
  sourceEntry: VaultEntry | null | undefined,
  fallback: string,
): string {
  const rawTarget = firstSheetWikilinkTarget(value)
  if (!rawTarget) return fallback

  const entry = resolveTargetEntry(entries, rawTarget, sourceEntry)
  return entry ? lookupColorForEntry(entries, entry) : 'var(--text-muted)'
}
