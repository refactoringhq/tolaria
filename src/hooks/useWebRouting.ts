import { useEffect, useRef, useCallback } from 'react'
import type { SidebarSelection, VaultEntry } from '../types'

/**
 * Web-only URL routing with pushState/popstate for note and view navigation.
 * Routes:
 *   / - home (inbox, filters, types, folders)
 *   /note/<path> - note selection
 *   /view/<filename> - saved view selection
 * 
 * Percent-encodes paths safely to handle spaces, unicode, and slashes in folder paths.
 * Does not block startup or show spinners — routing updates happen after cache-first paint.
 */

function encodePath(path: string): string {
  return path.split('/').map(encodeURIComponent).join('/')
}

function decodePath(encoded: string): string {
  return encoded.split('/').map(decodeURIComponent).join('/')
}

function buildUrl(selection: SidebarSelection): string {
  if (selection.kind === 'entity') {
    return `/note/${encodePath(selection.entry.path)}`
  }
  if (selection.kind === 'view') {
    return `/view/${encodePath(selection.filename)}`
  }
  return '/'
}

function parseUrl(pathname: string): { kind: 'note'; path: string } | { kind: 'view'; filename: string } | { kind: 'home' } {
  if (pathname.startsWith('/note/')) {
    const encodedPath = pathname.slice('/note/'.length)
    return { kind: 'note', path: decodePath(encodedPath) }
  }
  if (pathname.startsWith('/view/')) {
    const encodedFilename = pathname.slice('/view/'.length)
    return { kind: 'view', filename: decodePath(encodedFilename) }
  }
  return { kind: 'home' }
}

interface UseWebRoutingParams {
  selection: SidebarSelection
  onSelectNote: (entry: VaultEntry) => void
  onSetSelection: (selection: SidebarSelection) => void
  entries: VaultEntry[]
  views: Array<{ definition: { name: string }; filename: string; rootPath?: string }>
  enabled: boolean
}

export function useWebRouting({
  selection,
  onSelectNote,
  onSetSelection,
  entries,
  views,
  enabled,
}: UseWebRoutingParams): void {
  const isInitialMount = useRef(true)
  const lastPushedUrl = useRef<string | null>(null)
  const isHandlingPopState = useRef(false)

  // On initial mount, restore selection from URL
  useEffect(() => {
    if (!enabled || !isInitialMount.current) return
    isInitialMount.current = false

    const parsed = parseUrl(window.location.pathname)
    if (parsed.kind === 'note') {
      const entry = entries.find((e) => e.path === parsed.path)
      if (entry) {
        onSelectNote(entry)
        return
      }
    }
    if (parsed.kind === 'view') {
      const view = views.find((v) => v.filename === parsed.filename)
      if (view) {
        onSetSelection({ kind: 'view', filename: view.filename, rootPath: view.rootPath })
        return
      }
    }
  }, [enabled, entries, views, onSelectNote, onSetSelection])

  // Update URL when selection changes (but not during popstate handling)
  useEffect(() => {
    if (!enabled || isHandlingPopState.current) return

    const url = buildUrl(selection)
    if (url === lastPushedUrl.current) return

    lastPushedUrl.current = url
    window.history.pushState(null, '', url)
  }, [enabled, selection])

  // Handle browser back/forward
  const handlePopState = useCallback(() => {
    if (!enabled) return

    isHandlingPopState.current = true
    const parsed = parseUrl(window.location.pathname)

    if (parsed.kind === 'note') {
      const entry = entries.find((e) => e.path === parsed.path)
      if (entry) {
        onSelectNote(entry)
      }
    } else if (parsed.kind === 'view') {
      const view = views.find((v) => v.filename === parsed.filename)
      if (view) {
        onSetSelection({ kind: 'view', filename: view.filename, rootPath: view.rootPath })
      }
    } else {
      // Navigate to home/inbox
      onSetSelection({ kind: 'filter', filter: 'inbox' })
    }

    // Allow the next selection change to push state
    requestAnimationFrame(() => {
      isHandlingPopState.current = false
    })
  }, [enabled, entries, views, onSelectNote, onSetSelection])

  useEffect(() => {
    if (!enabled) return

    window.addEventListener('popstate', handlePopState)
    return () => {
      window.removeEventListener('popstate', handlePopState)
    }
  }, [enabled, handlePopState])
}
