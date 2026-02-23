import { useCallback, useEffect, useState } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { isTauri, mockInvoke } from '../mock-tauri'
import type { Settings } from '../types'

function tauriCall<T>(command: string, tauriArgs: Record<string, unknown>, mockArgs?: Record<string, unknown>): Promise<T> {
  return isTauri() ? invoke<T>(command, tauriArgs) : mockInvoke<T>(command, mockArgs ?? tauriArgs)
}

const EMPTY_SETTINGS: Settings = {
  anthropic_key: null,
  openai_key: null,
  google_key: null,
  github_token: null,
  github_username: null,
}

export function useSettings() {
  const [settings, setSettings] = useState<Settings>(EMPTY_SETTINGS)
  const [loaded, setLoaded] = useState(false)

  const loadSettings = useCallback(async () => {
    try {
      const s = await tauriCall<Settings>('get_settings', {})
      setSettings(s)
    } catch (err) {
      console.warn('Failed to load settings:', err)
    } finally {
      setLoaded(true)
    }
  }, [])

  useEffect(() => {
    loadSettings()
  }, [loadSettings])

  const saveSettings = useCallback(async (newSettings: Settings) => {
    try {
      await tauriCall<null>('save_settings', { settings: newSettings })
      setSettings(newSettings)
    } catch (err) {
      console.error('Failed to save settings:', err)
    }
  }, [])

  return { settings, loaded, saveSettings }
}
