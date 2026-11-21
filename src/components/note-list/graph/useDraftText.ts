import { useEffect, useRef, useState } from 'react'
import { useLatestRef } from '../../../hooks/useLatestRef'

/** A typed value is saved this long after the last keystroke (or at once on blur). */
export const DRAFT_SAVE_DELAY_MS = 400

/**
 * Local text for an input whose value is saved with the view: every keystroke is previewed at once, and
 * saved after a short pause, so typing a query never writes the view file per letter. The settings panel
 * mounts fresh each time it opens, so the draft starts from the saved value.
 */
export function useDraftText(saved: string, preview: (value: string) => void, save: (value: string) => void) {
  const [value, setValue] = useState(saved)
  const pending = useRef<string | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const saveRef = useLatestRef(save)

  const flush = () => {
    if (timer.current) clearTimeout(timer.current)
    timer.current = null
    const next = pending.current
    pending.current = null
    if (next !== null) saveRef.current(next)
  }

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current)
    if (pending.current !== null) saveRef.current(pending.current)
  }, [saveRef])

  const change = (next: string) => {
    setValue(next)
    preview(next)
    pending.current = next
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(flush, DRAFT_SAVE_DELAY_MS)
  }

  return { value, change, flush }
}
