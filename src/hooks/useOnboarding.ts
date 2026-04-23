import { useCallback, useEffect, useState, type Dispatch, type SetStateAction } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { isTauri, mockInvoke } from '../mock-tauri'
import { APP_STORAGE_KEYS, LEGACY_APP_STORAGE_KEYS, getAppStorageItem } from '../constants/appStorage'
import { buildGettingStartedVaultPath, formatGettingStartedCloneError } from '../utils/gettingStartedVault'
import { formatFolderPickerActionError, pickFolder } from '../utils/vault-dialog'

type OnboardingState =
  | { status: 'loading' }
  | { status: 'welcome'; defaultPath: string }
  | { status: 'vault-missing'; vaultPath: string; defaultPath: string }
  | { status: 'ready'; vaultPath: string }

type CreatingAction = 'template' | 'empty' | null
type SetError = Dispatch<SetStateAction<string | null>>
type SetCreatingAction = Dispatch<SetStateAction<CreatingAction>>

interface ReadyVaultHandlers {
  setState: Dispatch<SetStateAction<OnboardingState>>
  setUserReadyVaultPath: Dispatch<SetStateAction<string | null>>
}

interface TemplateVaultCreationOptions {
  handlers: ReadyVaultHandlers
  setCreatingAction: SetCreatingAction
  setError: SetError
  setLastTemplatePath: Dispatch<SetStateAction<string | null>>
  onTemplateVaultReady?: (vaultPath: string) => void
}

function tauriCall<T>(command: string, args: Record<string, unknown>): Promise<T> {
  return isTauri() ? invoke<T>(command, args) : mockInvoke<T>(command, args)
}

interface PersistedVaultList {
  vaults?: Array<{ label: string; path: string }>
  active_vault?: string | null
  hidden_defaults?: string[]
}

function wasDismissed(): boolean {
  try {
    return getAppStorageItem('welcomeDismissed') === '1'
  } catch {
    return false
  }
}

function markDismissed(): void {
  try {
    localStorage.setItem(APP_STORAGE_KEYS.welcomeDismissed, '1')
    localStorage.removeItem(LEGACY_APP_STORAGE_KEYS.welcomeDismissed)
  } catch {
    // localStorage may be unavailable in some contexts
  }
}

async function clearMissingActiveVault(missingPath: string): Promise<boolean> {
  try {
    const list = await tauriCall<PersistedVaultList>('load_vault_list', {})
    if (!list || list.active_vault !== missingPath) return false
    await tauriCall('save_vault_list', {
      list: {
        vaults: list.vaults ?? [],
        active_vault: null,
        hidden_defaults: list.hidden_defaults ?? [],
      },
    })
    return true
  } catch {
    // Best effort only — onboarding should still proceed
    return false
  }
}

function markVaultReady(
  handlers: ReadyVaultHandlers,
  vaultPath: string,
) {
  markDismissed()
  handlers.setState({ status: 'ready', vaultPath })
  handlers.setUserReadyVaultPath(vaultPath)
}

async function pickFolderWithOnboardingError(
  title: string,
  setError: SetError,
  action: string,
): Promise<string | null> {
  setError(null)

  try {
    return await pickFolder(title)
  } catch (err) {
    setError(formatFolderPickerActionError(action, err))
    return null
  }
}

function useTemplateVaultCreation(
  options: TemplateVaultCreationOptions,
) {
  return useCallback(async (targetPath: string) => {
    options.setCreatingAction('template')
    options.setError(null)
    options.setLastTemplatePath(targetPath)

    try {
      const vaultPath = await tauriCall<string>('create_getting_started_vault', { targetPath })
      markVaultReady(options.handlers, vaultPath)
      options.onTemplateVaultReady?.(vaultPath)
    } catch (err) {
      options.setError(formatGettingStartedCloneError(err))
    } finally {
      options.setCreatingAction(null)
    }
  }, [options])
}

function useCreateVaultHandler(
  createTemplateVault: (targetPath: string) => Promise<void>,
  setError: SetError,
) {
  return useCallback(async () => {
    const parentPath = await pickFolderWithOnboardingError(
      'Choose a parent folder for the Getting Started vault',
      setError,
      'Could not choose a parent folder',
    )
    if (!parentPath) return

    await createTemplateVault(buildGettingStartedVaultPath(parentPath))
  }, [createTemplateVault, setError])
}

function useCreateEmptyVaultHandler(
  handlers: ReadyVaultHandlers,
  setCreatingAction: SetCreatingAction,
  setError: SetError,
) {
  return useCallback(async () => {
    const path = await pickFolderWithOnboardingError(
      'Choose where to create your vault',
      setError,
      'Could not choose where to create your vault',
    )
    if (!path) return

    try {
      setCreatingAction('empty')
      const vaultPath = await tauriCall<string>('create_empty_vault', { targetPath: path })
      markVaultReady(handlers, vaultPath)
    } catch (err) {
      setError(typeof err === 'string' ? err : `Failed to create vault: ${err}`)
    } finally {
      setCreatingAction(null)
    }
  }, [handlers, setCreatingAction, setError])
}

function useOpenFolderHandler(
  handlers: ReadyVaultHandlers,
  setError: SetError,
) {
  return useCallback(async () => {
    const path = await pickFolderWithOnboardingError(
      'Open vault folder',
      setError,
      'Failed to open folder',
    )
    if (!path) return

    markVaultReady(handlers, path)
  }, [handlers, setError])
}

export function useOnboarding(
  initialVaultPath: string,
  onTemplateVaultReady?: (vaultPath: string) => void,
  initialVaultResolved = true,
) {
  const [state, setState] = useState<OnboardingState>({ status: 'loading' })
  const [creatingAction, setCreatingAction] = useState<CreatingAction>(null)
  const [error, setError] = useState<string | null>(null)
  const [lastTemplatePath, setLastTemplatePath] = useState<string | null>(null)
  const [userReadyVaultPath, setUserReadyVaultPath] = useState<string | null>(null)
  const readyVaultHandlers = { setState, setUserReadyVaultPath }

  useEffect(() => {
    let cancelled = false

    if (!initialVaultResolved) {
      return () => { cancelled = true }
    }

    async function check() {
      try {
        const defaultPath = await tauriCall<string>('get_default_vault_path', {})
        const exists = await tauriCall<boolean>('check_vault_exists', { path: initialVaultPath })

        if (cancelled) return

        if (exists) {
          setState({ status: 'ready', vaultPath: initialVaultPath })
          return
        }

        const missingWasPersistedActiveVault = await clearMissingActiveVault(initialVaultPath)
        if (cancelled) return

        if (wasDismissed() && missingWasPersistedActiveVault) {
          // Only show vault-missing when a previously selected vault path truly disappeared.
          setState({ status: 'vault-missing', vaultPath: initialVaultPath, defaultPath })
        } else {
          setState({ status: 'welcome', defaultPath })
        }
      } catch {
        // If commands fail (e.g. mock mode), just proceed
        if (!cancelled) setState({ status: 'ready', vaultPath: initialVaultPath })
      }
    }

    check()
    return () => { cancelled = true }
  }, [initialVaultPath, initialVaultResolved])

  const createTemplateVault = useTemplateVaultCreation({
    handlers: readyVaultHandlers,
    setCreatingAction,
    setError,
    setLastTemplatePath,
    onTemplateVaultReady,
  })

  const handleCreateVault = useCreateVaultHandler(createTemplateVault, setError)

  const retryCreateVault = useCallback(async () => {
    if (!lastTemplatePath) return
    await createTemplateVault(lastTemplatePath)
  }, [createTemplateVault, lastTemplatePath])

  const handleCreateEmptyVault = useCreateEmptyVaultHandler(
    readyVaultHandlers,
    setCreatingAction,
    setError,
  )

  const handleOpenFolder = useOpenFolderHandler(readyVaultHandlers, setError)

  const handleDismiss = useCallback(() => {
    markDismissed()
    setState({ status: 'ready', vaultPath: initialVaultPath })
  }, [initialVaultPath])

  const resolvedState = initialVaultResolved ? state : { status: 'loading' as const }

  return {
    state: resolvedState,
    creating: creatingAction !== null,
    creatingAction,
    error,
    canRetryTemplate: !!error && !!lastTemplatePath && creatingAction === null,
    handleCreateVault,
    retryCreateVault,
    handleCreateEmptyVault,
    handleOpenFolder,
    handleDismiss,
    userReadyVaultPath,
  }
}
