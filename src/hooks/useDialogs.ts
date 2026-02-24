import { useState, useCallback } from 'react'

export function useDialogs() {
  const [showCreateTypeDialog, setShowCreateTypeDialog] = useState(false)
  const [showQuickOpen, setShowQuickOpen] = useState(false)
  const [showCommandPalette, setShowCommandPalette] = useState(false)
  const [showAIChat, setShowAIChat] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [showGitHubVault, setShowGitHubVault] = useState(false)

  const openCreateType = useCallback(() => setShowCreateTypeDialog(true), [])
  const closeCreateType = useCallback(() => setShowCreateTypeDialog(false), [])
  const openQuickOpen = useCallback(() => setShowQuickOpen(true), [])
  const closeQuickOpen = useCallback(() => setShowQuickOpen(false), [])
  const openCommandPalette = useCallback(() => setShowCommandPalette(true), [])
  const closeCommandPalette = useCallback(() => setShowCommandPalette(false), [])
  const openSettings = useCallback(() => setShowSettings(true), [])
  const closeSettings = useCallback(() => setShowSettings(false), [])
  const openGitHubVault = useCallback(() => setShowGitHubVault(true), [])
  const closeGitHubVault = useCallback(() => setShowGitHubVault(false), [])
  const toggleAIChat = useCallback(() => setShowAIChat((c) => !c), [])

  return {
    showCreateTypeDialog, openCreateType, closeCreateType,
    showQuickOpen, openQuickOpen, closeQuickOpen,
    showCommandPalette, openCommandPalette, closeCommandPalette,
    showAIChat, toggleAIChat,
    showSettings, openSettings, closeSettings,
    showGitHubVault, openGitHubVault, closeGitHubVault,
  }
}
