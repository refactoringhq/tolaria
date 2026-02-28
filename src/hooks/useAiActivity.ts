import { useState, useEffect, useRef } from 'react'

export type HighlightElement = 'editor' | 'tab' | 'properties' | 'notelist' | null

export interface AiActivity {
  highlightElement: HighlightElement
  highlightPath: string | null
}

const WS_UI_URL = 'ws://localhost:9711'
const HIGHLIGHT_DURATION_MS = 800

/**
 * Listens on the UI WebSocket bridge (port 9711) for highlight events
 * from the AI agent. Sets highlightElement for 800ms then auto-clears.
 */
export function useAiActivity(): AiActivity {
  const [highlightElement, setHighlightElement] = useState<HighlightElement>(null)
  const [highlightPath, setHighlightPath] = useState<string | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    let ws: WebSocket | null = null
    let mounted = true

    try {
      ws = new WebSocket(WS_UI_URL)

      ws.onmessage = (event) => {
        if (!mounted) return
        try {
          const data = JSON.parse(event.data as string)
          if (data.type === 'ui_action' && data.action === 'highlight') {
            setHighlightElement(data.element ?? null)
            setHighlightPath(data.path ?? null)
            if (timerRef.current) clearTimeout(timerRef.current)
            timerRef.current = setTimeout(() => {
              if (mounted) {
                setHighlightElement(null)
                setHighlightPath(null)
              }
            }, HIGHLIGHT_DURATION_MS)
          }
        } catch {
          // Ignore parse errors from malformed messages
        }
      }

      ws.onerror = () => {
        // Silent — UI bridge may not be running
      }
    } catch {
      // WebSocket connection failed — bridge not available
    }

    return () => {
      mounted = false
      ws?.close()
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [])

  return { highlightElement, highlightPath }
}
