import { createContext, useContext, useEffect, useRef } from 'react'

export type PrepareEditorForSync = () => Promise<() => void>

export function createWorkspaceSyncEditors() {
  const editors = new Set<PrepareEditorForSync>()
  return {
    register: (prepare: PrepareEditorForSync) => {
      editors.add(prepare)
      return () => { editors.delete(prepare) }
    },
    prepare: async () => {
      const resumes: (() => void)[] = []
      const resume = () => { for (const action of resumes.splice(0).reverse()) action() }
      try {
        for (const prepare of editors) resumes.push(await prepare())
        return resume
      } catch (error) {
        resume()
        throw error
      }
    },
  }
}

export const WorkspaceSyncEditorsContext = createContext<ReturnType<typeof createWorkspaceSyncEditors> | null>(null)

export function useWorkspaceSyncEditor(prepare: PrepareEditorForSync) {
  const registry = useContext(WorkspaceSyncEditorsContext)
  const prepareRef = useRef(prepare)
  useEffect(() => { prepareRef.current = prepare }, [prepare])
  useEffect(() => registry?.register(() => prepareRef.current()), [registry])
}
