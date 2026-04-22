import { useCallback, useEffect, useMemo, useState } from 'react'
import type { AppearancePreferences } from '../lib/appearance'
import {
  applyAppearanceToDocument,
  readStoredAppearancePreferences,
  resolveAppearanceMode,
  writeStoredAppearancePreferences,
} from '../lib/appearance'

export function useAppearancePreferences() {
  const [preferences, setPreferences] = useState<AppearancePreferences>(() => (
    readStoredAppearancePreferences()
  ))

  const resolvedColorMode = useMemo(
    () => resolveAppearanceMode(preferences.themeId),
    [preferences.themeId],
  )

  useEffect(() => {
    applyAppearanceToDocument(preferences, resolvedColorMode)
    writeStoredAppearancePreferences(preferences)
  }, [preferences, resolvedColorMode])

  const savePreferences = useCallback((nextPreferences: AppearancePreferences) => {
    setPreferences(nextPreferences)
  }, [])

  return {
    preferences,
    resolvedColorMode,
    savePreferences,
  }
}
