import type {
  AppCommandShortcutEventInit,
  AppCommandShortcutEventOptions,
} from '../hooks/appCommandCatalog'

export interface LaputaTestBridge {
  activeTabPath?: string | null
  dispatchAppCommand?: (id: string) => void
  openDeepLink?: (url: string) => void
  dispatchShortcutEvent?: (init: AppCommandShortcutEventInit) => void
  dispatchBrowserMenuCommand?: (id: string) => void
  triggerMenuCommand?: (id: string) => Promise<unknown>
  triggerShortcutCommand?: (id: string, options?: AppCommandShortcutEventOptions) => void
  seedBlockNoteTable?: (columnWidths?: Array<number | null>) => Promise<void> | void
  seedAutoGitSavedChange?: () => Promise<void> | void
}

export type MockAiStreamChunk =
  | { kind: 'text'; text: string }
  | { kind: 'thinking'; text: string }
  | { kind: 'tool-start'; toolName: string; toolId: string; input?: string }
  | { kind: 'tool-done'; toolId: string; output?: string }
  | { kind: 'error'; message: string }
  | { kind: 'done' }

export interface MockAiStreamHook {
  setScript: (chunks: MockAiStreamChunk[]) => void
  next: () => number
  releaseUntil: (chunkCount: number) => number
  subscribe: (release: (chunk: MockAiStreamChunk) => void) => () => void
}

declare global {
  interface Window {
    __laputaTest?: LaputaTestBridge
    __mockAiStream?: MockAiStreamHook
  }
}
