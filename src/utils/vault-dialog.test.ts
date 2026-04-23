import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock isTauri — default to browser mode
vi.mock('../mock-tauri', () => ({
  isTauri: vi.fn(() => false),
}))

vi.mock('../lib/appUpdater', () => ({
  RESTART_REQUIRED_FOLDER_PICKER_MESSAGE:
    'Tolaria needs a restart before macOS can open another folder picker. Restart to apply the downloaded update and try again.',
  isRestartRequiredAfterUpdate: vi.fn(() => false),
}))

import { pickFolder } from './vault-dialog'
import { isTauri } from '../mock-tauri'
import {
  isRestartRequiredAfterUpdate,
  RESTART_REQUIRED_FOLDER_PICKER_MESSAGE,
} from '../lib/appUpdater'

describe('pickFolder', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('returns user input from prompt in browser mode', async () => {
    vi.mocked(isTauri).mockReturnValue(false)
    vi.spyOn(window, 'prompt').mockReturnValue('/Users/test/my-vault')

    const result = await pickFolder('Select vault')
    expect(result).toBe('/Users/test/my-vault')
    expect(window.prompt).toHaveBeenCalledWith('Select vault')
  })

  it('returns null when user cancels prompt in browser mode', async () => {
    vi.mocked(isTauri).mockReturnValue(false)
    vi.spyOn(window, 'prompt').mockReturnValue(null)

    const result = await pickFolder('Select vault')
    expect(result).toBeNull()
  })

  it('uses default title when none provided in browser mode', async () => {
    vi.mocked(isTauri).mockReturnValue(false)
    vi.spyOn(window, 'prompt').mockReturnValue('/some/path')

    await pickFolder()
    expect(window.prompt).toHaveBeenCalledWith('Enter folder path:')
  })

  it('blocks the native folder picker when a restart is required after update install', async () => {
    vi.mocked(isTauri).mockReturnValue(true)
    vi.mocked(isRestartRequiredAfterUpdate).mockReturnValue(true)

    await expect(pickFolder('Select vault')).rejects.toThrow(RESTART_REQUIRED_FOLDER_PICKER_MESSAGE)
  })
})
