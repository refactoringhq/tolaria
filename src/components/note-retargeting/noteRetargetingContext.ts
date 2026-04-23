import { createContext, createElement, useContext, type ReactNode } from 'react'

export interface NoteRetargetingContextValue {
  canDropNoteOnType: (notePath: string, type: string) => boolean
  dropNoteOnType: (notePath: string, type: string) => Promise<void>
  canDropNoteOnFolder: (notePath: string, folderPath: string) => boolean
  dropNoteOnFolder: (notePath: string, folderPath: string) => Promise<void>
}

export const noteRetargetingContext = createContext<NoteRetargetingContextValue | null>(null)

export function useNoteRetargetingContext() {
  return useContext(noteRetargetingContext)
}

export function NoteRetargetingProvider({
  children,
  value,
}: {
  children: ReactNode
  value: NoteRetargetingContextValue | null
}) {
  return createElement(noteRetargetingContext.Provider, { value }, children)
}
