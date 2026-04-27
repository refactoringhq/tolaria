import { useState, useEffect, useRef, useCallback } from 'react'

export type HighlightElement = 'editor' | 'tab' | 'properties' | 'notelist' | null

export interface AiActivity {
  highlightElement: HighlightElement
  highlightPath: string | null
}

export interface AiActivityCallbacks {
  onOpenNote?: (path: string) => void
  onOpenTab?: (path: string) => void
  onSetFilter?: (type: string) => void
  onVaultChanged?: (path?: string) => void
}

const WS_UI_URL = 'ws://localhost:9711'
const HIGHLIGHT_DURATION_MS = 800
const RECONNECT_DELAY_MS = 3000

/**
 * Listens on the UI WebSocket bridge (port 9711) for UI action events
 * from the MCP server. Handles highlight, open_note, open_tab, set_filter,
 * and vault_changed actions.
 */
export function useAiActivity(callbacks?: AiActivityCallbacks): AiActivity {
  const [highlightElement, setHighlightElement] = useState<HighlightElement>(null)
  const [highlightPath, setHighlightPath] = useState<string | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const callbacksRef = useRef(callbacks)
  useEffect(() => { callbacksRef.current = callbacks })

  const handleMessage = useCallback((event: MessageEvent) => {
    try {
      const data = JSON.parse(event.data as string)
      if (data.type !== 'ui_action') return
      switch (data.action) {
        case 'highlight':
          setHighlightElement(data.element ?? null)
          setHighlightPath(data.path ?? null)
          if (timerRef.current) clearTimeout(timerRef.current)
          timerRef.current = setTimeout(() => {
            setHighlightElement(null)
            setHighlightPath(null)
          }, HIGHLIGHT_DURATION_MS)
          break
        case 'open_note':
          if (data.path) callbacksRef.current?.onOpenNote?.(data.path)
          break
        case 'open_tab':
          if (data.path) callbacksRef.current?.onOpenTab?.(data.path)
          break
        case 'set_filter':
          if (data.filterType) callbacksRef.current?.onSetFilter?.(data.filterType)
          break
        case 'vault_changed':
          callbacksRef.current?.onVaultChanged?.(data.path)
          break
      }
    } catch {
      // Ignore parse errors from malformed messages
    }
  }, [])

  useEffect(() => {
    let ws: WebSocket | null = null
    let mounted = true
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null

    function connect() {
      if (!mounted) return
      try {
        ws = new WebSocket(WS_UI_URL)
        ws.onopen = () => { if (!mounted) ws?.close() }
        ws.onmessage = handleMessage
        ws.onclose = () => {
          if (mounted) reconnectTimer = setTimeout(connect, RECONNECT_DELAY_MS)
        }
        ws.onerror = () => { /* Silent — bridge may not be running */ }
      } catch {
        if (mounted) reconnectTimer = setTimeout(connect, RECONNECT_DELAY_MS)
      }
    }

    connect()

    return () => {
      mounted = false
      if (ws?.readyState === WebSocket.OPEN) ws.close()
      if (timerRef.current) clearTimeout(timerRef.current)
      if (reconnectTimer) clearTimeout(reconnectTimer)
    }
  }, [handleMessage])

  return { highlightElement, highlightPath }
}
