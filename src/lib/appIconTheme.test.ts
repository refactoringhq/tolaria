import { beforeEach, describe, expect, it, vi } from 'vitest'
import { syncAppIconThemeMode, syncNativeWindowBackground } from './appIconTheme'

const mocks = vi.hoisted(() => ({
  invoke: vi.fn(),
  isTauri: vi.fn(),
  setBackgroundColor: vi.fn(),
}))

vi.mock('@tauri-apps/api/core', () => ({
  invoke: mocks.invoke,
}))

vi.mock('../mock-tauri', () => ({
  isTauri: mocks.isTauri,
}))

vi.mock('@tauri-apps/api/window', () => ({
  getCurrentWindow: () => ({ setBackgroundColor: mocks.setBackgroundColor }),
}))

describe('syncAppIconThemeMode', () => {
  beforeEach(() => {
    mocks.invoke.mockReset()
    mocks.isTauri.mockReset()
  })

  it('skips browser runs', async () => {
    mocks.isTauri.mockReturnValue(false)

    await syncAppIconThemeMode('dark')

    expect(mocks.invoke).not.toHaveBeenCalled()
  })

  it('sends the resolved theme mode to Tauri', async () => {
    mocks.isTauri.mockReturnValue(true)
    mocks.invoke.mockResolvedValue(undefined)

    await syncAppIconThemeMode('dark')

    expect(mocks.invoke).toHaveBeenCalledWith('update_app_icon', { themeMode: 'dark' })
  })
})

describe('syncNativeWindowBackground', () => {
  beforeEach(() => {
    mocks.isTauri.mockReset()
    mocks.setBackgroundColor.mockReset()
  })

  it('uses the dark sidebar surface for Hybrid', async () => {
    mocks.isTauri.mockReturnValue(true)
    await syncNativeWindowBackground('hybrid')
    expect(mocks.setBackgroundColor).toHaveBeenCalledWith('#191713')
  })

  it('uses the light surface for Light mode', async () => {
    mocks.isTauri.mockReturnValue(true)
    await syncNativeWindowBackground('light')
    expect(mocks.setBackgroundColor).toHaveBeenCalledWith('#F8F7F4')
  })
})
