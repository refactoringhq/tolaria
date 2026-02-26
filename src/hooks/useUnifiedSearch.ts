import { useState, useRef, useEffect, useCallback } from 'react'
import type { SearchResult } from '../types'
import { invoke } from '@tauri-apps/api/core'
import { isTauri, mockInvoke } from '../mock-tauri'

interface SearchResultData {
  title: string
  path: string
  snippet: string
  score: number
  note_type: string | null
}

interface SearchResponseData {
  results: SearchResultData[]
  elapsed_ms: number
}

const DEBOUNCE_MS = 300
const HYBRID_TIMEOUT_MS = 5000

function searchCall(args: Record<string, unknown>): Promise<SearchResponseData> {
  return isTauri()
    ? invoke<SearchResponseData>('search_vault', args)
    : mockInvoke<SearchResponseData>('search_vault', args)
}

function searchWithTimeout(args: Record<string, unknown>, ms: number): Promise<SearchResponseData> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Search timeout')), ms)
    searchCall(args).then(
      result => { clearTimeout(timer); resolve(result) },
      err => { clearTimeout(timer); reject(err) },
    )
  })
}

function mapResults(raw: SearchResultData[]): SearchResult[] {
  return raw.map(r => ({
    title: r.title,
    path: r.path,
    snippet: r.snippet,
    score: r.score,
    noteType: r.note_type,
  }))
}

export function useUnifiedSearch(vaultPath: string, active: boolean) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [loading, setLoading] = useState(false)
  const [elapsedMs, setElapsedMs] = useState<number | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const searchGenRef = useRef(0)

  const reset = useCallback(() => {
    setQuery('')
    setResults([])
    setSelectedIndex(0)
    setElapsedMs(null)
    setLoading(false)
    searchGenRef.current++
  }, [])

  // On any active change: cancel inflight + debounce, then reset if opening
  useEffect(() => {
    searchGenRef.current++
    clearTimeout(debounceRef.current ?? undefined)
    debounceRef.current = null
    if (active) reset()
  }, [active, reset])

  const performSearch = useCallback(async (q: string) => {
    if (!q.trim()) { setResults([]); setElapsedMs(null); setLoading(false); return }
    searchGenRef.current++
    const gen = searchGenRef.current
    setLoading(true)
    try {
      const response = await searchCall({ vaultPath, query: q, mode: 'keyword', limit: 20 })
      if (gen !== searchGenRef.current) return
      setResults(mapResults(response.results))
      setElapsedMs(response.elapsed_ms)
      setSelectedIndex(0)
    } catch {
      if (gen !== searchGenRef.current) return
      setLoading(false)
      return
    }
    try {
      const response = await searchWithTimeout(
        { vaultPath, query: q, mode: 'hybrid', limit: 20 },
        HYBRID_TIMEOUT_MS,
      )
      if (gen !== searchGenRef.current) return
      setResults(mapResults(response.results))
      setElapsedMs(response.elapsed_ms)
      setSelectedIndex(prev => Math.min(prev, Math.max(response.results.length - 1, 0)))
    } catch { /* Hybrid timed out — keyword results remain */ } finally {
      if (gen === searchGenRef.current) setLoading(false)
    }
  }, [vaultPath])

  useEffect(() => {
    clearTimeout(debounceRef.current ?? undefined)
    debounceRef.current = null
    if (!query.trim()) {
      setResults([])
      setElapsedMs(null)
      searchGenRef.current++
      setLoading(false)
      return
    }
    debounceRef.current = setTimeout(() => performSearch(query), DEBOUNCE_MS)
    return () => {
      clearTimeout(debounceRef.current ?? undefined)
      debounceRef.current = null
    }
  }, [query, performSearch])

  return { query, setQuery, results, selectedIndex, setSelectedIndex, loading, elapsedMs }
}
