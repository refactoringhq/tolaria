import { createContext } from 'react'
import type { NativeWorkspaceSelection } from './nativeWorkspacePicker'

export type NativeWorkspaceState = {
  selection: NativeWorkspaceSelection | null
  restorePending: boolean
  open: (initialUri?: string | null) => Promise<void>
}

export const NativeWorkspaceContext = createContext<NativeWorkspaceState>({
  selection: null,
  restorePending: false,
  open: async () => {},
})
