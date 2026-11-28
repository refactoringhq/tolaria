import { invoke } from '@tauri-apps/api/core'
import { isTauri } from '../mock-tauri'
import { isMac } from '../utils/platform'
import { resolveThemeMode, type ResolvedThemeMode, type ThemeMode } from './themeMode'

export async function syncAppIconThemeMode(themeMode: ResolvedThemeMode): Promise<void> {
  if (!isTauri()) return

  try {
    await invoke('update_app_icon', { themeMode })
  } catch (error) {
    console.warn('Failed to update app icon for theme mode', error)
  }
}

export async function syncNativeWindowBackground(themeMode: ThemeMode): Promise<void> {
  if (!isTauri()) return

  const color = themeMode === 'hybrid'
    ? '#191713'
    : resolveThemeMode(themeMode) === 'dark' ? '#25231F' : '#F8F7F4'

  try {
    const { getCurrentWindow } = await import('@tauri-apps/api/window')
    const appWindow = getCurrentWindow()
    if (isMac() && appWindow.label === 'main') {
      document.body.classList.add('mac-sidebar-vibrancy')
      return
    }
    await appWindow.setBackgroundColor(color)
  } catch (error) {
    console.warn('Failed to update native window background for theme mode', error)
  }
}
