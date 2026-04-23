import type { ReactNode } from 'react'
import {
  noteRetargetingContext,
  type NoteRetargetingContextValue,
} from './noteRetargetingContext'

export function NoteRetargetingProvider({
  children,
  value,
}: {
  children: ReactNode
  value: NoteRetargetingContextValue | null
}) {
  return (
    <noteRetargetingContext.Provider value={value}>
      {children}
    </noteRetargetingContext.Provider>
  )
}
