import { useEffect, useRef } from 'react'
import type { CalendarViewMode } from '../../../collections/collectionTypes'

export interface CalendarNavigation {
  previous: () => void
  next: () => void
  today: () => void
  setView: (view: CalendarViewMode) => void
}

type NavigationAction = 'previous' | 'next' | 'today' | 'month' | 'week'

const NAVIGATION_KEYS = new Map<string, NavigationAction>([
  ['ArrowLeft', 'previous'],
  ['ArrowRight', 'next'],
  ['t', 'today'],
  ['m', 'month'],
  ['w', 'week'],
])

/** Keys typed into fields, the editor panel, or open menus and dialogs never move the calendar. */
const IGNORED_TARGETS = 'input, textarea, select, [contenteditable="true"], .app__editor, [role="dialog"], [role="menu"], [role="listbox"]'

function hasModifier(event: KeyboardEvent): boolean {
  return event.metaKey || event.ctrlKey || event.altKey || event.shiftKey
}

function navigationAction(event: KeyboardEvent): NavigationAction | undefined {
  if (event.defaultPrevented || hasModifier(event)) return undefined
  if (event.target instanceof Element && event.target.closest(IGNORED_TARGETS)) return undefined
  return NAVIGATION_KEYS.get(event.key) ?? NAVIGATION_KEYS.get(event.key.toLowerCase())
}

function runNavigation(navigation: CalendarNavigation, action: NavigationAction) {
  if (action === 'month' || action === 'week') navigation.setView(action)
  else if (action === 'previous') navigation.previous()
  else if (action === 'next') navigation.next()
  else navigation.today()
}

/** ←/→ move a month or week, T jumps to today, M and W switch the view. */
export function useCalendarShortcuts(navigation: CalendarNavigation) {
  const latest = useRef(navigation)
  useEffect(() => {
    latest.current = navigation
  })
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const action = navigationAction(event)
      if (!action) return
      event.preventDefault()
      runNavigation(latest.current, action)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])
}
