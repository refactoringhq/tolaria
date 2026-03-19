import { isTauri } from '../mock-tauri'

/**
 * Opens a note in a new Tauri window with a minimal editor-only layout.
 * In browser mode (non-Tauri), this is a no-op.
 */
export async function openNoteInNewWindow(notePath: string, vaultPath: string, noteTitle: string): Promise<void> {
  if (!isTauri()) return

  const { WebviewWindow } = await import('@tauri-apps/api/webviewWindow')
  const label = `note-${Date.now()}`
  const url = `index.html?window=note&path=${encodeURIComponent(notePath)}&vault=${encodeURIComponent(vaultPath)}&title=${encodeURIComponent(noteTitle)}`

  new WebviewWindow(label, {
    url,
    title: noteTitle,
    width: 800,
    height: 700,
    resizable: true,
    titleBarStyle: 'overlay',
    hiddenTitle: true,
  })
}
