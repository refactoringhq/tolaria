import { isTauri } from '../mock-tauri'
import { shouldUseLinuxWindowChrome } from './platform'
import { rememberNoteWindowParams } from './windowMode'

export function buildNoteWindowUrl(notePath: string, vaultPath: string, noteTitle: string, windowLabel?: string): string {
  const params = new URLSearchParams({
    window: 'note',
    path: notePath,
    vault: vaultPath,
    title: noteTitle,
  })

  if (windowLabel) {
    params.set('windowLabel', windowLabel)
  }

  return `/?${params.toString()}`
}

/**
 * Opens a note in a new Tauri window with a minimal editor-only layout.
 * In browser mode (non-Tauri), this is a no-op.
 */
export async function openNoteInNewWindow(notePath: string, vaultPath: string, noteTitle: string): Promise<void> {
  if (!isTauri()) return

  const { WebviewWindow } = await import('@tauri-apps/api/webviewWindow')
  const label = `note-${Date.now()}`
  rememberNoteWindowParams(label, { notePath, vaultPath, noteTitle })

  new WebviewWindow(label, {
    url: buildNoteWindowUrl(notePath, vaultPath, noteTitle, label),
    title: noteTitle,
    width: 800,
    height: 700,
    resizable: true,
    titleBarStyle: 'overlay',
    hiddenTitle: true,
    decorations: !shouldUseLinuxWindowChrome(),
  })
}
