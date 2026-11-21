import { useEffect, useState } from 'react'
import type { GraphColorGroup } from '../../../collections/collectionTypes'
import type { VaultEntry } from '../../../types'
import { getTypeColor } from '../../../utils/typeColors'
import { matchesGraphQuery, parseGraphQuery } from './graphQuery'

/** WebGL needs concrete colors, so theme tokens are resolved once per theme into rgb(a) strings. */
export interface GraphPalette {
  relationshipEdge: string
  wikiLinkEdge: string
  transparent: string
  /** Ring around the note open in the editor panel. */
  highlight: string
  /** Fill of the hovered note. */
  accent: string
  /** The first matching color group's color, else the type color. */
  nodeColor: (entry: VaultEntry) => string
  /** Removes the color probe; node colors resolve lazily until then. */
  dispose: () => void
}

const RELATIONSHIP_EDGE_ALPHA = 0.7
const WIKI_LINK_EDGE_ALPHA = 0.4
const HIGHLIGHT_ALPHA = 0.35
const FALLBACK_RGB: readonly number[] = [128, 128, 128]

/** `rgb(1, 2, 3)` / `rgba(1, 2, 3, 0.5)` → `[1, 2, 3]`; anything else falls back to gray. */
export function rgbChannels(color: string): number[] {
  const channels = color.match(/[\d.]+/g)?.slice(0, 3).map(Number) ?? []
  return channels.length === 3 && channels.every(Number.isFinite) ? channels : [...FALLBACK_RGB]
}

export function withAlpha(color: string, alpha: number): string {
  const [red, green, blue] = rgbChannels(color)
  return `rgba(${red}, ${green}, ${blue}, ${alpha})`
}

const mixCache = new Map<string, number[]>()

function cachedChannels(color: string): number[] {
  const cached = mixCache.get(color)
  if (cached) return cached
  const channels = rgbChannels(color)
  if (mixCache.size > 256) mixCache.clear()
  mixCache.set(color, channels)
  return channels
}

/** `from` blended toward `to` by `amount` (0 → from, 1 → to), opaque. */
export function mixColors(from: string, to: string, amount: number): string {
  const left = cachedChannels(from)
  const right = cachedChannels(to)
  const blend = (index: number) => Math.round((left.at(index) ?? 0) + ((right.at(index) ?? 0) - (left.at(index) ?? 0)) * amount)
  return `rgba(${blend(0)}, ${blend(1)}, ${blend(2)}, 1)`
}

type ColorResolver = (cssColor: string) => string

/** Resolves CSS colors (tokens included) through a hidden probe inside `host`, caching each answer. */
function cssColorResolver(host: HTMLElement): { resolve: ColorResolver; dispose: () => void } {
  const probe = document.createElement('span')
  probe.style.display = 'none'
  host.appendChild(probe)
  const cache = new Map<string, string>()
  const resolve = (cssColor: string) => {
    const cached = cache.get(cssColor)
    if (cached) return cached
    probe.style.color = ''
    probe.style.color = cssColor
    const resolved = getComputedStyle(probe).color || 'rgb(128, 128, 128)'
    cache.set(cssColor, resolved)
    return resolved
  }
  return { resolve, dispose: () => probe.remove() }
}

type EntryColor = (entry: VaultEntry) => string | null

/** Color groups in order: the first whose query matches the note wins. */
function groupColorReader(groups: readonly GraphColorGroup[], resolve: ColorResolver): EntryColor {
  const parsed = groups
    .filter((group) => group.query.trim() && group.color)
    .map((group) => ({ terms: parseGraphQuery(group.query), color: withAlpha(resolve(getTypeColor(null, group.color)), 1) }))
  return (entry) => parsed.find((group) => matchesGraphQuery(entry, group.terms))?.color ?? null
}

export function readGraphPalette(host: HTMLElement, typeEntryMap: Record<string, VaultEntry>, groups: readonly GraphColorGroup[] = []): GraphPalette {
  const { resolve, dispose } = cssColorResolver(host)
  const edgeBase = resolve('var(--muted-foreground)')
  const nodeColors = new Map<string, string>()
  const groupColor = groupColorReader(groups, resolve)
  const typeColor = (entry: VaultEntry) => {
    const key = entry.isA ?? ''
    const cached = nodeColors.get(key)
    if (cached) return cached
    const typeColor = getTypeColor(entry.isA, entry.isA ? Reflect.get(typeEntryMap, entry.isA)?.color : null)
    const color = withAlpha(resolve(typeColor), 1)
    nodeColors.set(key, color)
    return color
  }
  const nodeColor = (entry: VaultEntry) => groupColor(entry) ?? typeColor(entry)
  return {
    relationshipEdge: withAlpha(edgeBase, RELATIONSHIP_EDGE_ALPHA),
    wikiLinkEdge: withAlpha(edgeBase, WIKI_LINK_EDGE_ALPHA),
    transparent: 'rgba(0, 0, 0, 0)',
    highlight: withAlpha(resolve('var(--primary)'), HIGHLIGHT_ALPHA),
    accent: withAlpha(resolve('var(--primary)'), 1),
    nodeColor,
    dispose,
  }
}

function themeSignature(): string {
  const root = document.documentElement
  return `${root.getAttribute('data-theme') ?? ''}|${root.getAttribute('data-theme-mode') ?? ''}|${root.className}`
}

/** Bumps whenever the app theme changes, so the canvas re-reads its colors. */
export function useThemeSignature(): string {
  const [signature, setSignature] = useState(themeSignature)
  useEffect(() => {
    const observer = new MutationObserver(() => setSignature(themeSignature()))
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'data-theme-mode', 'class'] })
    return () => observer.disconnect()
  }, [])
  return signature
}
