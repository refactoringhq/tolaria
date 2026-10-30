/**
 * Mock Tauri invoke for browser testing.
 * When running outside Tauri (e.g. in Chrome via localhost:5173),
 * this provides realistic test data so the UI can be verified visually.
 */

import { assertVaultWritable } from '../lib/offline/offlineMode'
import { resolveBrowserBackendKind } from '../lib/platformCapabilities'
import { createMockAiStreamHook } from './mock-ai-stream'
import { MOCK_CONTENT } from './mock-content'
import { addMockEntry, mockHandlers, trackMockChange, updateMockContent } from './mock-handlers'
import { tryVaultApi } from './vault-api'

export { addMockEntry, trackMockChange, updateMockContent }

type MockHandler = (args?: unknown) => unknown

/** Simulated IPC round trip for demo data. */
const MOCK_IPC_LATENCY_MS = 100

function registerMockHandlers(): Record<string, MockHandler> {
  return Object.fromEntries(
    Object.entries(mockHandlers).map(([command, handler]) => [
      command,
      (args?: unknown) => Reflect.apply(handler, undefined, [args]),
    ]),
  )
}

const registeredMockHandlers = registerMockHandlers()

export function isTauri(): boolean {
  if (typeof globalThis !== 'undefined' && typeof (globalThis as { isTauri?: unknown }).isTauri === 'boolean') {
    return Boolean((globalThis as { isTauri?: unknown }).isTauri)
  }

  return typeof window !== 'undefined' && ('__TAURI__' in window || '__TAURI_INTERNALS__' in window)
}

// Initialize window globals for browser testing and Playwright overrides
if (typeof window !== 'undefined') {
  window.__mockContent = MOCK_CONTENT
  window.__mockHandlers = registeredMockHandlers
  if (import.meta.env.DEV) window.__mockAiStream = createMockAiStreamHook()
}

function resolveMockHandler(command: string) {
  const windowHandler = typeof window === 'undefined' || !window.__mockHandlers
    ? undefined
    : Reflect.get(window.__mockHandlers, command) as MockHandler | undefined
  return windowHandler ?? Reflect.get(registeredMockHandlers, command) as MockHandler | undefined
}

/** Commands that change the vault. Offline on the web they fail loudly instead of piling up here. */
const VAULT_WRITE_COMMANDS = new Set([
  'save_note_content', 'save_image', 'copy_image_to_vault', 'download_remote_image_to_vault',
  'rename_note', 'rename_note_filename', 'move_note_to_folder', 'move_note_to_workspace', 'sync_note_title',
  'delete_note', 'batch_delete_notes', 'batch_archive_notes', 'batch_trash_notes', 'purge_trash', 'empty_trash',
  'migrate_is_a_to_type', 'save_view_cmd', 'delete_view_cmd', 'repair_vault',
])

/** On a Tolaria remote the stand-ins answer at once: a fake delay here held startup back (TOL-206). */
async function simulateIpcLatency(): Promise<void> {
  if (resolveBrowserBackendKind() === 'remote') return
  await new Promise((r) => setTimeout(r, MOCK_IPC_LATENCY_MS))
}

export async function mockInvoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  if (VAULT_WRITE_COMMANDS.has(cmd)) assertVaultWritable('saving changes')
  const vaultResult = await tryVaultApi<T>(cmd, args)
  if (vaultResult !== undefined) return vaultResult

  const handler = resolveMockHandler(cmd)
  if (handler) {
    await simulateIpcLatency()
    return handler(args) as T
  }
  throw new Error(`No mock handler for command: ${cmd}`)
}
