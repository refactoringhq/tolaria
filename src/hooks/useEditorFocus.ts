import { useEffect } from 'react'

/**
 * Focus editor when a new note is created (signaled via custom event).
 * Uses adaptive timing: fast rAF path when editor is already mounted,
 * short timeout when waiting for first mount.
 */
export function useEditorFocus(
  editor: { focus: () => void },
  editorMountedRef: React.RefObject<boolean>,
) {
  useEffect(() => {
    const handler = (e: Event) => {
      const t0 = (e as CustomEvent).detail?.t0 as number | undefined
      const doFocus = () => {
        editor.focus()
        if (t0) console.debug(`[perf] createNote → focus: ${(performance.now() - t0).toFixed(1)}ms`)
      }
      if (editorMountedRef.current) {
        requestAnimationFrame(doFocus)
      } else {
        setTimeout(doFocus, 80)
      }
    }
    window.addEventListener('laputa:focus-editor', handler)
    return () => window.removeEventListener('laputa:focus-editor', handler)
  }, [editor, editorMountedRef])
}
