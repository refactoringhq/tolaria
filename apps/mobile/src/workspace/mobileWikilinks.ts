import { normalizedMobileSearchQuery } from './mobileNoteSearch'
import type { MobileNote } from './mobileWorkspaceModel'

type WikilinkText = string
type WikilinkTarget = string
type MobileWikilinkResolutionKey = {
  exactTarget: string
  humanizedLastSegment: string | null
  lastSegment: string
  targetWithoutWorkspace: string
  workspaceAlias: string | null
}

const mobileWikilinkHrefPrefix = 'tolaria://wikilink/'

export type MobileParsedWikilink = {
  display: string
  target: WikilinkTarget
}

export function parseMobileWikilink(value: WikilinkText): MobileParsedWikilink | null {
  const match = value.trim().match(/^\[\[([^\]|]+)(?:\|([^\]]+))?\]\]$/u)
  if (!match) return null

  return {
    display: (match[2] ?? match[1]).trim(),
    target: match[1].trim(),
  }
}

export function normalizeMobileWikilinkTarget(value: string): string {
  const withoutHeading = value.split('#', 1)[0] ?? ''
  return normalizedMobileSearchQuery(withoutHeading).replace(/\.md$/iu, '')
}

function mobileWikilinkResolutionKey(
  normalizedTarget: string,
  workspaceAliases: Set<string>,
): MobileWikilinkResolutionKey {
  const segments = normalizedTarget.split('/').filter(Boolean)
  const candidateWorkspaceAlias = segments.length > 1 ? segments[0] : null
  const workspaceAlias = candidateWorkspaceAlias && workspaceAliases.has(candidateWorkspaceAlias)
    ? candidateWorkspaceAlias
    : null
  const targetWithoutWorkspace = workspaceAlias ? segments.slice(1).join('/') : normalizedTarget
  const lastSegment = segments.at(-1) ?? normalizedTarget
  const humanizedLastSegment = lastSegment.replaceAll('-', ' ')

  return {
    exactTarget: normalizedTarget,
    humanizedLastSegment: humanizedLastSegment === lastSegment ? null : humanizedLastSegment,
    lastSegment,
    targetWithoutWorkspace,
    workspaceAlias,
  }
}

function workspaceScopedNotes(notes: MobileNote[], alias: string | null): MobileNote[] {
  if (!alias) return notes
  return notes.filter((note) => normalizedWorkspaceAlias(note) === alias)
}

function findMobileNoteByPathSuffix(
  notes: MobileNote[],
  key: MobileWikilinkResolutionKey,
): MobileNote | null {
  const target = key.targetWithoutWorkspace
  if (!target.includes('/')) return null

  return notes.find((note) => {
    const pathStem = normalizeMobileWikilinkTarget(note.path ?? note.id)
    return pathStem === target || pathStem.endsWith(`/${target}`)
  }) ?? null
}

function findMobileNoteByFilenameStem(
  notes: MobileNote[],
  key: MobileWikilinkResolutionKey,
): MobileNote | null {
  return notes.find((note) => {
    const stem = note.path ?? note.id
    const filenameStem = normalizeMobileWikilinkTarget(stem.split('/').at(-1) ?? stem)
    return filenameStem === key.exactTarget
      || filenameStem === key.targetWithoutWorkspace
      || filenameStem === key.lastSegment
  }) ?? null
}

function findMobileNoteByAlias(
  notes: MobileNote[],
  key: MobileWikilinkResolutionKey,
): MobileNote | null {
  return notes.find((note) => {
    return (note.aliases ?? []).some((alias) => {
      const normalizedAlias = normalizeMobileWikilinkTarget(alias)
      return normalizedAlias === key.exactTarget || normalizedAlias === key.targetWithoutWorkspace
    })
  }) ?? null
}

function findMobileNoteByTitle(
  notes: MobileNote[],
  key: MobileWikilinkResolutionKey,
): MobileNote | null {
  return notes.find((note) => {
    const title = normalizeMobileWikilinkTarget(note.title)
    return title === key.exactTarget
      || title === key.targetWithoutWorkspace
      || title === key.lastSegment
      || title === key.humanizedLastSegment
  }) ?? null
}

export function mobileNoteForWikilinkTarget(
  notes: MobileNote[],
  target: WikilinkTarget,
): MobileNote | null {
  const normalizedTarget = normalizeMobileWikilinkTarget(target)
  if (!normalizedTarget) return null

  const key = mobileWikilinkResolutionKey(normalizedTarget, mobileWorkspaceAliases(notes))
  const candidates = workspaceScopedNotes(notes, key.workspaceAlias)
  return findMobileNoteByPathSuffix(candidates, key)
    ?? findMobileNoteByFilenameStem(candidates, key)
    ?? findMobileNoteByAlias(candidates, key)
    ?? findMobileNoteByTitle(candidates, key)
}

export function mobileWikilinkTargetForNote(note: MobileNote, sourceNote?: MobileNote | null): WikilinkTarget {
  const target = mobileWikilinkLocalTarget(note)
  const alias = normalizedWorkspaceAlias(note)
  if (!alias || alias === normalizedWorkspaceAlias(sourceNote)) return target

  return `${alias}/${targetWithoutWorkspaceAlias(target, alias)}`
}

export function mobileWikilinkHref(target: WikilinkTarget): string {
  return `${mobileWikilinkHrefPrefix}${encodeURIComponent(target)}`
}

export function mobileNoteIdForWikilinkTarget(
  notes: MobileNote[],
  target: WikilinkTarget,
): string | null {
  return mobileNoteForWikilinkTarget(notes, target)?.id ?? null
}

function mobileWikilinkLocalTarget(note: MobileNote): WikilinkTarget {
  return (note.path ?? note.id).replace(/\.[^.]+$/u, '')
}

function targetWithoutWorkspaceAlias(target: WikilinkTarget, alias: string): WikilinkTarget {
  return target.toLowerCase().startsWith(`${alias}/`) ? target.slice(alias.length + 1) : target
}

function mobileWorkspaceAliases(notes: MobileNote[]): Set<string> {
  return new Set(notes.map(normalizedWorkspaceAlias).filter((alias): alias is string => Boolean(alias)))
}

function normalizedWorkspaceAlias(note: MobileNote | null | undefined): string | null {
  return note?.workspaceAlias?.trim().toLowerCase() || null
}
