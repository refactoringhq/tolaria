import { createContext, useContext, useEffect, useRef } from 'react'

export type PrepareEditorForSync = () => Promise<() => void>

export function createWorkspaceSyncEditors() {
  const editors = new Map<PrepareEditorForSync, string | undefined>()
  const dirtyListeners = new Set<() => void>()
  let blocked = false
  let generation = 0
  return {
    isBlocked: () => blocked,
    setBlocked: (value: boolean) => { blocked = value },
    generation: () => generation,
    beginReplacement: () => { generation += 1 },
    markDirty: () => { for (const listener of dirtyListeners) listener() },
    subscribeDirty: (listener: () => void) => {
      dirtyListeners.add(listener)
      return () => { dirtyListeners.delete(listener) }
    },
    selectedNoteId: () => [...editors.values()].filter(Boolean).at(-1),
    register: (prepare: PrepareEditorForSync, noteId?: string) => {
      editors.set(prepare, noteId)
      return () => { editors.delete(prepare) }
    },
    prepare: async () => {
      const resumes: (() => void)[] = []
      const resume = () => { for (const action of resumes.splice(0).reverse()) action() }
      try {
        for (const prepare of editors.keys()) resumes.push(await prepare())
        return resume
      } catch (error) {
        resume()
        throw error
      }
    },
  }
}

export const WorkspaceSyncEditorsContext = createContext<ReturnType<typeof createWorkspaceSyncEditors> | null>(null)

export function useWorkspaceSyncEditor(prepare: PrepareEditorForSync, noteId?: string) {
  const registry = useContext(WorkspaceSyncEditorsContext)
  const prepareRef = useRef(prepare)
  useEffect(() => { prepareRef.current = prepare }, [prepare])
  useEffect(() => registry?.register(() => prepareRef.current(), noteId), [noteId, registry])
}
