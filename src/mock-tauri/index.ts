/**
 * Mock Tauri invoke for browser testing.
 * When running outside Tauri (e.g. in Chrome via localhost:5173),
 * this provides realistic test data so the UI can be verified visually.
 */

import { MOCK_CONTENT } from './mock-content'
import { mockHandlers, addMockEntry, updateMockContent } from './mock-handlers'
import { tryVaultApi } from './vault-api'

export { addMockEntry, updateMockContent }

export function isTauri(): boolean {
  return typeof window !== 'undefined' && ('__TAURI__' in window || '__TAURI_INTERNALS__' in window)
}

// Initialize window.__mockContent for browser testing
if (typeof window !== 'undefined') {
  window.__mockContent = MOCK_CONTENT
}

export async function mockInvoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  const vaultResult = await tryVaultApi<T>(cmd, args)
  if (vaultResult !== undefined) return vaultResult

  const handler = mockHandlers[cmd]
  if (handler) {
    await new Promise((r) => setTimeout(r, 100))
    return handler(args) as T
  }
  throw new Error(`No mock handler for command: ${cmd}`)
}
