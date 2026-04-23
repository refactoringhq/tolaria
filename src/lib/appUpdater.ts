import { Channel, invoke } from '@tauri-apps/api/core'
import { normalizeReleaseChannel } from './releaseChannel'

export interface AppUpdateMetadata {
  currentVersion: string
  version: string
  date?: string
  body?: string
}

export type AppUpdateDownloadEvent =
  | { event: 'Started'; data: { contentLength?: number } }
  | { event: 'Progress'; data: { chunkLength: number } }
  | { event: 'Finished' }

export const RESTART_REQUIRED_FOLDER_PICKER_MESSAGE =
  'Tolaria needs a restart before macOS can open another folder picker. Restart to apply the downloaded update and try again.'

let restartRequiredAfterUpdate = false

export function markRestartRequiredAfterUpdate(): void {
  restartRequiredAfterUpdate = true
}

export function clearRestartRequiredAfterUpdate(): void {
  restartRequiredAfterUpdate = false
}

export function isRestartRequiredAfterUpdate(): boolean {
  return restartRequiredAfterUpdate
}

export async function checkForAppUpdate(
  releaseChannel: string | null | undefined,
): Promise<AppUpdateMetadata | null> {
  return invoke<AppUpdateMetadata | null>('check_for_app_update', {
    releaseChannel: normalizeReleaseChannel(releaseChannel),
  })
}

export async function downloadAndInstallAppUpdate(
  releaseChannel: string | null | undefined,
  expectedVersion: string,
  onEvent: (event: AppUpdateDownloadEvent) => void,
): Promise<void> {
  const channel = new Channel<AppUpdateDownloadEvent>()
  channel.onmessage = onEvent

  await invoke('download_and_install_app_update', {
    releaseChannel: normalizeReleaseChannel(releaseChannel),
    expectedVersion,
    onEvent: channel,
  })
  markRestartRequiredAfterUpdate()
}
