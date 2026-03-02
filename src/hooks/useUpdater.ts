import { useCallback, useEffect, useRef, useState } from 'react'
import { isTauri } from '../mock-tauri'
import { openExternalUrl } from '../utils/url'

const RELEASE_NOTES_URL = 'https://refactoringhq.github.io/laputa-app/'

export type UpdateStatus =
  | { state: 'idle' }
  | { state: 'available'; version: string; notes: string | undefined }
  | { state: 'downloading'; version: string; progress: number }
  | { state: 'ready'; version: string }
  | { state: 'error' }

export interface UpdateActions {
  startDownload: () => void
  openReleaseNotes: () => void
  dismiss: () => void
}

export function useUpdater(): { status: UpdateStatus; actions: UpdateActions } {
  const [status, setStatus] = useState<UpdateStatus>({ state: 'idle' })
  const updateRef = useRef<unknown>(null)

  useEffect(() => {
    if (!isTauri()) return

    const checkForUpdates = async () => {
      try {
        const { check } = await import('@tauri-apps/plugin-updater')
        const update = await check()
        if (!update) return // up to date

        updateRef.current = update
        setStatus({
          state: 'available',
          version: update.version,
          notes: update.body ?? undefined,
        })
      } catch {
        // Network error or 404 — fail silently
        console.warn('[updater] Failed to check for updates')
      }
    }

    // Delay so the app can render first
    const timer = setTimeout(checkForUpdates, 3000)
    return () => clearTimeout(timer)
  }, [])

  const startDownload = useCallback(async () => {
    const update = updateRef.current as {
      version: string
      downloadAndInstall: (cb: (event: { event: string; data?: { contentLength?: number; chunkLength?: number } }) => void) => Promise<void>
    } | null
    if (!update) return

    let totalBytes = 0
    let downloadedBytes = 0

    setStatus({ state: 'downloading', version: update.version, progress: 0 })

    try {
      await update.downloadAndInstall((event) => {
        if (event.event === 'Started' && event.data?.contentLength) {
          totalBytes = event.data.contentLength
        } else if (event.event === 'Progress' && event.data?.chunkLength) {
          downloadedBytes += event.data.chunkLength
          const progress = totalBytes > 0 ? Math.min(downloadedBytes / totalBytes, 1) : 0
          setStatus({ state: 'downloading', version: update.version, progress })
        } else if (event.event === 'Finished') {
          setStatus({ state: 'ready', version: update.version })
        }
      })

      // If Finished wasn't emitted via callback, set ready after await resolves
      setStatus((prev) => (prev.state === 'downloading' ? { state: 'ready', version: update.version } : prev))
    } catch {
      console.warn('[updater] Download failed')
      setStatus({ state: 'error' })
    }
  }, [])

  const openReleaseNotes = useCallback(() => {
    openExternalUrl(RELEASE_NOTES_URL)
  }, [])

  const dismiss = useCallback(() => {
    setStatus({ state: 'idle' })
  }, [])

  return { status, actions: { startDownload, openReleaseNotes, dismiss } }
}

/**
 * Trigger app restart after an update has been downloaded.
 * Separated so the component can call it on button click.
 */
export async function restartApp(): Promise<void> {
  try {
    const { relaunch } = await import('@tauri-apps/plugin-process')
    await relaunch()
  } catch {
    console.warn('[updater] Failed to relaunch')
  }
}
