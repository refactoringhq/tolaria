import type { MobileNote, MobileWorkspaceSnapshot, MobileWorkspaceSource } from './mobileWorkspaceModel'

export const TOLARIA_MOBILE_DEEP_LINK_SCHEME = 'tolaria'

export type MobileDeepLinkSlug = string & { readonly mobileDeepLinkSlug: true }
export type MobileDeepLinkPath = string & { readonly mobileDeepLinkPath: true }

export type MobileDeepLinkBuildError = 'missing_note' | 'missing_vault' | 'unsafe_path'

export type MobileDeepLinkBuildResult =
  | { ok: true; url: string }
  | { error: MobileDeepLinkBuildError; ok: false }

export type MobileDeepLinkBuildInput = {
  note: MobileNote | null
  source?: MobileWorkspaceSource
  vaultRootUri?: string | null
}

export type MobileIncomingDeepLink =
  | { kind: 'ignored' }
  | { error: string; kind: 'invalid' }
  | { kind: 'note'; relativePath: MobileDeepLinkPath; slug: MobileDeepLinkSlug }

export type MobileDeepLinkVaultChoice = {
  id: string
  label: string
  selected: boolean
  select: () => Promise<unknown>
}

export function parseMobileIncomingDeepLink(rawUrl: string): MobileIncomingDeepLink {
  let url: URL
  try {
    url = new URL(rawUrl)
  } catch {
    return { error: 'malformed_url', kind: 'invalid' }
  }

  if (url.protocol !== `${TOLARIA_MOBILE_DEEP_LINK_SCHEME}:`) return { kind: 'ignored' }
  if (['qa', 'mobile-ui-lab'].includes(url.hostname) || url.searchParams.has('gitProbe')) {
    return { kind: 'ignored' }
  }

  const parsed = parseNoteDeepLink(rawUrl, url)
  if ('error' in parsed) return { error: parsed.error, kind: 'invalid' }
  return { kind: 'note', relativePath: parsed.relativePath, slug: url.hostname as MobileDeepLinkSlug }
}

function parseNoteDeepLink(
  rawUrl: string,
  url: URL,
): { error: string } | { relativePath: MobileDeepLinkPath } {
  if (!url.hostname) return { error: 'missing_vault' }
  const encodedPath = encodedNotePath(rawUrl)
  if (!encodedPath) return { error: 'missing_path' }
  const relativePath = decodeNotePath(encodedPath)
  return relativePath ? { relativePath: relativePath as MobileDeepLinkPath } : { error: 'unsafe_path' }
}

function encodedNotePath(rawUrl: string): string | null {
  return rawUrl.match(/^tolaria:\/\/[^/?#]+(\/[^?#]*)/iu)?.[1]?.replace(/^\/+/, '') ?? null
}

function decodeNotePath(encodedPath: string): string | null {
  const decodedSegments: string[] = []
  for (const segment of encodedPath.split('/')) {
    const decoded = decodeSafePathSegment(segment)
    if (!decoded) return null
    decodedSegments.push(decoded)
  }
  return decodedSegments.join('/')
}

function decodeSafePathSegment(segment: string): string | null {
  if (!segment) return null
  try {
    const decoded = decodeURIComponent(segment)
    if (!decoded || decoded === '.' || decoded === '..' || /[\\/]/u.test(decoded)) return null
    return decoded
  } catch {
    return null
  }
}

export function resolveMobileDeepLinkVault(
  slug: MobileDeepLinkSlug,
  vaults: readonly MobileDeepLinkVaultChoice[],
): { kind: 'matched'; vault: MobileDeepLinkVaultChoice } | { kind: 'unknown' | 'ambiguous' } {
  const target = slug.toLocaleLowerCase()
  const matches = vaults.filter((vault) => {
    return slugifyWorkspaceAlias(vault.label) === target
      || slugifyWorkspaceAlias(vault.id) === target
  })
  if (matches.length === 0) return { kind: 'unknown' }
  if (matches.length > 1) return { kind: 'ambiguous' }
  return { kind: 'matched', vault: matches[0] }
}

export function resolveMobileDeepLinkNote(
  snapshot: MobileWorkspaceSnapshot,
  relativePath: MobileDeepLinkPath,
): string | null {
  const expectedPath = normalizeRelativePath(relativePath)
  const notes = new Map([...snapshot.notes, ...(snapshot.allNotes ?? [])].map((note) => [note.id, note]))
  for (const note of notes.values()) {
    if (normalizeRelativePath(note.path ?? note.id) === expectedPath) return note.id
  }
  return null
}

export function buildMobileDeepLinkForNote({
  note,
  source,
  vaultRootUri,
}: MobileDeepLinkBuildInput): MobileDeepLinkBuildResult {
  if (!note) return { error: 'missing_note', ok: false }

  const relativePath = mobileNoteDeepLinkPath(note)
  if (!relativePath) return { error: 'unsafe_path', ok: false }

  const slug = activeVaultSlug({ note, source, vaultRootUri })
  if (!slug) return { error: 'missing_vault', ok: false }

  return {
    ok: true,
    url: `${TOLARIA_MOBILE_DEEP_LINK_SCHEME}://${slug}/${encodeRelativePath(relativePath)}`,
  }
}

function activeVaultSlug(input: MobileDeepLinkBuildInput & { note: MobileNote }): string {
  const savedAlias = sourceValue(input.source?.alias)
  if (savedAlias) return slugifyWorkspaceAlias(savedAlias)

  const labelSlug = slugifyWorkspaceAlias(activeVaultLabel(input))
  if (labelSlug) return labelSlug

  return slugifyWorkspaceAlias(labelFromWorkspacePath(activeVaultPath(input)))
}

function activeVaultLabel({
  note,
  source,
}: MobileDeepLinkBuildInput & { note: MobileNote }): string {
  const label = sourceValue(source?.label)
  if (label) return label

  return note.workspace
}

function activeVaultPath({
  source,
  vaultRootUri,
}: MobileDeepLinkBuildInput): string {
  const sourcePath = sourceValue(source?.vaultPath)
  if (sourcePath) return sourcePath

  return sourceValue(vaultRootUri)
}

function mobileNoteDeepLinkPath(note: MobileNote): string | null {
  const explicitPath = safeRelativeNotePath(note.path)
  if (explicitPath) return explicitPath

  return safeRelativeNotePath(note.id)
}

function labelFromWorkspacePath(path: unknown): string {
  return stringValue(path).split(/[\\/]/u).filter(Boolean).at(-1) ?? ''
}

function slugifyWorkspaceAlias(label: unknown): string {
  return stringValue(label)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, '-')
    .replace(/^-+|-+$/gu, '')
}

function safeRelativeNotePath(path: unknown): string | null {
  const normalized = stringValue(path).replaceAll('\\', '/').trim().replace(/^\/+|\/+$/gu, '')
  if (!normalized || normalized.includes('://')) return null

  const segments = normalized.split('/')
  if (segments.some((segment) => !isSafePathSegment(segment))) return null
  return normalized
}

function isSafePathSegment(segment: string): boolean {
  return segment.length > 0
    && segment !== '.'
    && segment !== '..'
    && !segment.includes('\\')
}

function encodeRelativePath(path: string): string {
  return path
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/')
}

function stringValue(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

function normalizeRelativePath(path: string): string {
  return path.replaceAll('\\', '/').replace(/^\/+|\/+$/gu, '')
}

function sourceValue(value: unknown): string {
  return stringValue(value).trim()
}
