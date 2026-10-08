import { useCallback, useEffect, useMemo, useRef, useState, type MutableRefObject } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { isTauri, mockInvoke } from '../mock-tauri'
import { createTranslator, type AppLocale } from '../lib/i18n'
import { errorMessage } from '../utils/vaultErrors'

export type McpStatus = 'checking' | 'installed' | 'not_installed'
type ManualConfigSnippet = string
type ManualConfigKind = 'standard' | 'opencode'
type McpCommand =
  | 'check_mcp_status'
  | 'copy_text_to_clipboard'
  | 'get_mcp_config_snippet'
  | 'get_opencode_mcp_config_snippet'
  | 'register_mcp_tools'
  | 'remove_mcp_tools'
type McpCommandResult = string
type McpStatusResponse = string
type ToastHandler = (msg: ToastMessage) => void
type ToastMessage = string
type VaultPath = string
type Translator = ReturnType<typeof createTranslator>

interface ManualMcpConfigState {
  error: ToastMessage | null
  loading: boolean
  opencodeSnippet: ManualConfigSnippet | null
  standardSnippet: ManualConfigSnippet | null
  vaultPath: VaultPath
}

interface ManualMcpConfigSnippets {
  opencodeSnippet: ManualConfigSnippet
  standardSnippet: ManualConfigSnippet
}

const EMPTY_MANUAL_CONFIG: ManualMcpConfigState = {
  error: null,
  loading: false,
  opencodeSnippet: null,
  standardSnippet: null,
  vaultPath: '',
}

function tauriCall<T>(command: McpCommand, args?: Record<string, unknown>): Promise<T> {
  return isTauri() ? invoke<T>(command, args) : mockInvoke<T>(command, args)
}

function normalizeMcpStatus(value: McpStatusResponse | null | undefined): McpStatus {
  return value === 'installed' ? 'installed' : 'not_installed'
}

function fetchMcpStatus(vaultPath: VaultPath): Promise<McpStatus> {
  return tauriCall<McpStatusResponse>('check_mcp_status', { vaultPath })
    .then(normalizeMcpStatus, () => 'not_installed')
}

function connectSuccessToast(result: McpCommandResult, t: Translator): ToastMessage {
  return result === 'registered'
    ? t('mcp.toast.connected')
    : t('mcp.toast.refreshed')
}

function disconnectSuccessToast(result: McpCommandResult, t: Translator): ToastMessage {
  return result === 'removed'
    ? t('mcp.toast.disconnected')
    : t('mcp.toast.alreadyDisconnected')
}

function visibleManualConfig(
  state: ManualMcpConfigState,
  vaultPath: VaultPath,
): ManualMcpConfigState {
  return state.vaultPath === vaultPath ? state : EMPTY_MANUAL_CONFIG
}

async function writeClipboardText(value: ManualConfigSnippet, t: Translator): Promise<void> {
  if (isTauri()) {
    await tauriCall('copy_text_to_clipboard', { text: value })
    return
  }

  if (!navigator.clipboard?.writeText) {
    throw new Error(t('mcp.error.clipboardUnavailable'))
  }

  await navigator.clipboard.writeText(value)
}

function snippetForKind(
  snippets: ManualMcpConfigSnippets,
  kind: ManualConfigKind,
): ManualConfigSnippet {
  return kind === 'opencode' ? snippets.opencodeSnippet : snippets.standardSnippet
}

function useManualMcpConfig(
  vaultPath: VaultPath,
  onToastRef: MutableRefObject<ToastHandler>,
  t: Translator,
) {
  const [manualConfig, setManualConfig] = useState<ManualMcpConfigState>(EMPTY_MANUAL_CONFIG)

  const loadMcpConfigSnippets = useCallback(async () => {
    setManualConfig({
      error: null,
      loading: true,
      opencodeSnippet: null,
      standardSnippet: null,
      vaultPath,
    })
    try {
      const [standardSnippet, opencodeSnippet] = await Promise.all([
        tauriCall<ManualConfigSnippet>('get_mcp_config_snippet', { vaultPath }),
        tauriCall<ManualConfigSnippet>('get_opencode_mcp_config_snippet', { vaultPath }),
      ])
      const snippets = { opencodeSnippet, standardSnippet }
      setManualConfig({ error: null, loading: false, ...snippets, vaultPath })
      return snippets
    } catch (error) {
      const message = errorMessage(error)
      setManualConfig({
        error: message,
        loading: false,
        opencodeSnippet: null,
        standardSnippet: null,
        vaultPath,
      })
      throw error
    }
  }, [vaultPath])

  const copyMcpConfig = useCallback(async (kind: ManualConfigKind = 'standard') => {
    try {
      const snippets = await loadMcpConfigSnippets()
      await writeClipboardText(snippetForKind(snippets, kind), t)
      onToastRef.current(t('mcp.toast.configCopied'))
      return true
    } catch (error) {
      onToastRef.current(t('mcp.toast.configCopyFailed', { error: errorMessage(error) }))
      return false
    }
  }, [loadMcpConfigSnippets, onToastRef, t])

  const currentManualConfig = visibleManualConfig(manualConfig, vaultPath)

  return {
    mcpConfigSnippet: currentManualConfig.standardSnippet,
    opencodeMcpConfigSnippet: currentManualConfig.opencodeSnippet,
    mcpConfigLoading: currentManualConfig.loading,
    mcpConfigError: currentManualConfig.error,
    loadMcpConfigSnippets,
    copyMcpConfig,
    copyOpenCodeMcpConfig: () => copyMcpConfig('opencode'),
  }
}

/**
 * Detects whether the active vault is explicitly connected to external MCP
 * clients and exposes connect / disconnect actions.
 */
export function useMcpStatus(
  vaultPath: VaultPath,
  onToast: ToastHandler,
  locale: AppLocale = 'en',
) {
  const [status, setStatus] = useState<McpStatus>('checking')
  const t = useMemo(() => createTranslator(locale), [locale])
  const onToastRef = useRef(onToast)
  useEffect(() => { onToastRef.current = onToast })
  const manualConfigActions = useManualMcpConfig(vaultPath, onToastRef, t)

  const refreshMcpStatus = useCallback(async () => {
    const nextStatus = await fetchMcpStatus(vaultPath)
    setStatus(nextStatus)
    return nextStatus
  }, [vaultPath])

  useEffect(() => {
    let cancelled = false
    void Promise.resolve().then(() => {
      if (!cancelled) setStatus('checking')
    })

    fetchMcpStatus(vaultPath).then((nextStatus) => {
      if (!cancelled) setStatus(nextStatus)
    })

    return () => { cancelled = true }
  }, [vaultPath])

  const connectMcp = useCallback(async () => {
    setStatus('checking')
    try {
      const result = await tauriCall<string>('register_mcp_tools', { vaultPath })
      setStatus('installed')
      onToastRef.current(connectSuccessToast(result, t))
      return true
    } catch (e) {
      setStatus('not_installed')
      onToastRef.current(t('mcp.toast.setupFailed', { error: errorMessage(e) }))
      return false
    }
  }, [t, vaultPath])

  const disconnectMcp = useCallback(async () => {
    setStatus('checking')
    try {
      const result = await tauriCall<string>('remove_mcp_tools')
      setStatus('not_installed')
      onToastRef.current(disconnectSuccessToast(result, t))
      return true
    } catch (e) {
      const nextStatus = await refreshMcpStatus()
      setStatus(nextStatus)
      onToastRef.current(t('mcp.toast.disconnectFailed', { error: errorMessage(e) }))
      return false
    }
  }, [refreshMcpStatus, t])

  return {
    mcpStatus: status,
    refreshMcpStatus,
    connectMcp,
    disconnectMcp,
    ...manualConfigActions,
  }
}
