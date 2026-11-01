import { useEffect, useMemo, useRef, useState } from 'react'
import { Linking } from 'react-native'
import { useMobileAnalytics } from '../analytics/useMobileAnalytics'
import { mobileText } from '../i18n/mobileText'
import {
  type MobileDeepLinkPath,
  type MobileDeepLinkSlug,
  type MobileDeepLinkVaultChoice,
  parseMobileIncomingDeepLink,
  resolveMobileDeepLinkNote,
  resolveMobileDeepLinkVault,
} from './mobileDeepLinks'
import type { MobileWorkspaceSnapshot } from './mobileWorkspaceModel'

type PendingLink = { relativePath: MobileDeepLinkPath; slug: MobileDeepLinkSlug }
type VaultPicker = { choices: MobileDeepLinkVaultChoice[] } | null
type IncomingLinkState = {
  notice: string | null
  pending: PendingLink | null
  setNotice: (message: string | null) => void
  setPending: (link: PendingLink | null) => void
}
type RouteResolution =
  | { kind: 'failure'; messageKey: Parameters<typeof mobileText>[0]; outcome: 'unknown_vault' | 'ambiguous_vault' | 'missing_file' }
  | { kind: 'open'; noteId: string }
  | { kind: 'select'; vault: MobileDeepLinkVaultChoice }
  | { kind: 'wait' }

export function useMobileIncomingDeepLink(picker: VaultPicker, snapshot: MobileWorkspaceSnapshot) {
  const analytics = useMobileAnalytics()
  const incoming = useIncomingLinkState()
  const noteId = useIncomingLinkSelection({ analytics, incoming, picker, snapshot })
  return { noteId, notice: incoming.notice }
}

function useIncomingLinkState(): IncomingLinkState {
  const [pending, setPending] = useState<PendingLink | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  useIncomingLinkEvents(setPending, setNotice)
  useNoticeTimeout(notice, setNotice)
  return useMemo(() => ({ notice, pending, setNotice, setPending }), [notice, pending])
}

function useIncomingLinkEvents(
  setPending: IncomingLinkState['setPending'],
  setNotice: IncomingLinkState['setNotice'],
) {
  useEffect(() => {
    let mounted = true
    const receive = (url: string) => receiveIncomingUrl(url, mounted, setPending, setNotice)
    const subscription = Linking.addEventListener('url', ({ url }) => receive(url))
    Linking.getInitialURL().then((url) => { if (url) receive(url) }).catch(() => {})
    return () => {
      mounted = false
      subscription.remove()
    }
  }, [setNotice, setPending])
}

function receiveIncomingUrl(
  url: string,
  mounted: boolean,
  setPending: IncomingLinkState['setPending'],
  setNotice: IncomingLinkState['setNotice'],
) {
  const parsed = parseMobileIncomingDeepLink(url)
  if (!mounted || parsed.kind === 'ignored') return
  if (parsed.kind === 'invalid') {
    setNotice(messageForError(parsed.error))
    setPending(null)
    return
  }
  setNotice(null)
  setPending({ relativePath: parsed.relativePath, slug: parsed.slug })
}

function useNoticeTimeout(notice: string | null, setNotice: IncomingLinkState['setNotice']) {
  useEffect(() => {
    if (!notice) return undefined
    const timeout = setTimeout(() => setNotice(null), 8_000)
    return () => clearTimeout(timeout)
  }, [notice, setNotice])
}

function useIncomingLinkSelection({
  analytics,
  incoming,
  picker,
  snapshot,
}: {
  analytics: ReturnType<typeof useMobileAnalytics>
  incoming: IncomingLinkState
  picker: VaultPicker
  snapshot: MobileWorkspaceSnapshot
}) {
  const [noteId, setNoteId] = useState<string | null>(null)
  const selecting = useRef<string | null>(null)
  useEffect(() => {
    const pending = incoming.pending
    if (!pending || !picker?.choices.length) return
    let cancelled = false
    void Promise.resolve().then(() => {
      if (cancelled) return
      const resolution = resolvePendingLink(pending, picker, snapshot)
      applyRouteResolution(resolution, { analytics, isCancelled: () => cancelled, incoming, selecting, setNoteId })
    })
    return () => { cancelled = true }
  }, [analytics, incoming, picker, snapshot])
  return noteId
}

function resolvePendingLink(
  pending: PendingLink,
  picker: NonNullable<VaultPicker>,
  snapshot: MobileWorkspaceSnapshot,
): RouteResolution {
  const resolved = resolveMobileDeepLinkVault(pending.slug, picker.choices)
  if (resolved.kind !== 'matched') {
    return resolved.kind === 'unknown'
      ? { kind: 'failure', messageKey: 'deepLinks.error.unknownVault', outcome: 'unknown_vault' }
      : { kind: 'failure', messageKey: 'deepLinks.error.ambiguousVault', outcome: 'ambiguous_vault' }
  }
  if (!resolved.vault.selected) return { kind: 'select', vault: resolved.vault }
  if (!activeVaultMatches(snapshot, pending.slug)) return { kind: 'wait' }
  const noteId = resolveMobileDeepLinkNote(snapshot, pending.relativePath)
  return noteId
    ? { kind: 'open', noteId }
    : { kind: 'failure', messageKey: 'deepLinks.error.missingFile', outcome: 'missing_file' }
}

function applyRouteResolution(
  resolution: RouteResolution,
  { analytics, isCancelled, incoming, selecting, setNoteId }: {
    analytics: ReturnType<typeof useMobileAnalytics>
    isCancelled: () => boolean
    incoming: IncomingLinkState
    selecting: { current: string | null }
    setNoteId: (noteId: string | null) => void
  },
) {
  if (resolution.kind === 'wait' || isCancelled()) return
  if (resolution.kind === 'failure') {
    analytics.capture({ name: 'mobile_deep_link_opened', outcome: resolution.outcome })
    incoming.setNotice(mobileText(resolution.messageKey))
    incoming.setPending(null)
    return
  }
  if (resolution.kind === 'select') {
    selectDeepLinkVault(resolution.vault, { analytics, incoming, selecting, isCancelled })
    return
  }
  incoming.setPending(null)
  analytics.capture({ name: 'mobile_deep_link_opened', outcome: 'opened' })
  setNoteId(resolution.noteId)
  incoming.setNotice(null)
}

function selectDeepLinkVault(
  vault: MobileDeepLinkVaultChoice,
  { analytics, incoming, selecting, isCancelled }: {
    analytics: ReturnType<typeof useMobileAnalytics>
    incoming: IncomingLinkState
    selecting: { current: string | null }
    isCancelled: () => boolean
  },
) {
  if (selecting.current === vault.id) return
  selecting.current = vault.id
  void vault.select().catch(() => {
    if (isCancelled()) return
    analytics.capture({ name: 'mobile_deep_link_opened', outcome: 'unavailable_vault' })
    incoming.setNotice(mobileText('deepLinks.error.unavailableVault'))
    incoming.setPending(null)
  }).finally(() => { selecting.current = null })
}

function activeVaultMatches(snapshot: MobileWorkspaceSnapshot, slug: string): boolean {
  const source = snapshot.source
  return !source || slugify(source.label) === slug || slugify(source.alias ?? '') === slug
}

function messageForError(error: string): string {
  const keys: Record<string, Parameters<typeof mobileText>[0]> = {
    malformed_url: 'deepLinks.error.malformedUrl',
    missing_path: 'deepLinks.error.missingPath',
    missing_vault: 'deepLinks.error.missingVault',
    unsafe_path: 'deepLinks.error.unsafePath',
  }
  return mobileText(keys[error] ?? 'deepLinks.error.malformedUrl')
}

function slugify(value: string): string {
  return value.trim().toLocaleLowerCase().replace(/[^a-z0-9]+/gu, '-').replace(/^-+|-+$/gu, '')
}
