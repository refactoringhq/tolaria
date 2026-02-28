import { useState, useEffect, useCallback } from 'react'

const ZOOM_KEY = 'laputa:zoom-level'
const MIN_ZOOM = 80
const MAX_ZOOM = 150
const STEP = 10
const DEFAULT_ZOOM = 100

function loadPersistedZoom(): number {
  try {
    const stored = localStorage.getItem(ZOOM_KEY)
    if (stored !== null) {
      const val = Number(stored)
      if (val >= MIN_ZOOM && val <= MAX_ZOOM && val % STEP === 0) return val
    }
  } catch { /* localStorage unavailable */ }
  return DEFAULT_ZOOM
}

function applyZoomToDocument(level: number): void {
  document.documentElement.style.setProperty('zoom', `${level}%`)
}

function persistZoom(level: number): void {
  try { localStorage.setItem(ZOOM_KEY, String(level)) } catch { /* ignore */ }
}

export function useZoom() {
  const [zoomLevel, setZoomLevel] = useState(loadPersistedZoom)

  // Apply persisted zoom on mount
  useEffect(() => {
    applyZoomToDocument(zoomLevel)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps -- only on mount

  const zoomIn = useCallback(() => {
    setZoomLevel(prev => {
      const next = Math.min(MAX_ZOOM, prev + STEP)
      applyZoomToDocument(next)
      persistZoom(next)
      return next
    })
  }, [])

  const zoomOut = useCallback(() => {
    setZoomLevel(prev => {
      const next = Math.max(MIN_ZOOM, prev - STEP)
      applyZoomToDocument(next)
      persistZoom(next)
      return next
    })
  }, [])

  const zoomReset = useCallback(() => {
    setZoomLevel(DEFAULT_ZOOM)
    applyZoomToDocument(DEFAULT_ZOOM)
    persistZoom(DEFAULT_ZOOM)
  }, [])

  return { zoomLevel, zoomIn, zoomOut, zoomReset }
}
