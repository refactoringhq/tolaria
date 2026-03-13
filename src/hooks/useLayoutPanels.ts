import { useCallback, useState } from 'react'

export function useLayoutPanels() {
  const [sidebarWidth, setSidebarWidth] = useState(250)
  const [noteListWidth, setNoteListWidth] = useState(300)
  const [inspectorWidth, setInspectorWidth] = useState(280)
  const [inspectorCollapsed, setInspectorCollapsed] = useState(false)
  const handleSidebarResize = useCallback((delta: number) => setSidebarWidth((w) => Math.max(150, Math.min(400, w + delta))), [])
  const handleNoteListResize = useCallback((delta: number) => setNoteListWidth((w) => Math.max(200, Math.min(500, w + delta))), [])
  const handleInspectorResize = useCallback((delta: number) => setInspectorWidth((w) => Math.max(200, Math.min(500, w - delta))), [])
  return { sidebarWidth, noteListWidth, inspectorWidth, inspectorCollapsed, setInspectorCollapsed, handleSidebarResize, handleNoteListResize, handleInspectorResize }
}
