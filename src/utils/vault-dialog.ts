/**
 * Vault dialog utilities.
 * In Tauri mode, uses the native dialog plugin for folder picking.
 * In browser mode, falls back to window.prompt() for testing.
 */

import { isTauri } from '../mock-tauri'
import {
  isRestartRequiredAfterUpdate,
  RESTART_REQUIRED_FOLDER_PICKER_MESSAGE,
} from '../lib/appUpdater'

export class NativeFolderPickerBlockedError extends Error {
  constructor(message = RESTART_REQUIRED_FOLDER_PICKER_MESSAGE) {
    super(message)
    this.name = 'NativeFolderPickerBlockedError'
  }
}

export function isNativeFolderPickerBlockedError(
  error: unknown,
): error is NativeFolderPickerBlockedError {
  return error instanceof NativeFolderPickerBlockedError
}

export function formatFolderPickerActionError(
  action: string,
  error: unknown,
): string {
  if (isNativeFolderPickerBlockedError(error)) {
    return error.message
  }

  const message =
    typeof error === 'string'
      ? error
      : error instanceof Error
        ? error.message
        : ''

  return message ? `${action}: ${message}` : action
}

/**
 * Opens a native folder picker dialog (Tauri) or falls back to prompt (browser).
 * Returns the selected folder path, or null if the user cancelled.
 */
export async function pickFolder(title?: string): Promise<string | null> {
  if (isTauri()) {
    if (isRestartRequiredAfterUpdate()) {
      throw new NativeFolderPickerBlockedError()
    }

    const { open } = await import('@tauri-apps/plugin-dialog')
    const selected = await open({
      directory: true,
      multiple: false,
      title: title ?? 'Select folder',
    })
    return selected as string | null
  }
  // Browser fallback: prompt for path
  return prompt(title ?? 'Enter folder path:')
}
