import { expect, it, vi } from 'vitest'
import { createWorkspaceSyncEditors } from '../workspaceSyncEditors'
import { runSavedVaultOperation } from './savedVaultOperation'
import { persistWorkspaceOperations } from './workspaceWriteQueue'

it('flushes editor and disk before replacing the workspace, including on transport failure', async () => {
  const editors = createWorkspaceSyncEditors()
  const events: string[] = []
  const resume = vi.fn()
  editors.register(async () => {
    events.push('editor')
    void persistWorkspaceOperations('saved-operation', [async () => { events.push('disk') }])
    return resume
  }, 'note-one')
  const refresh = vi.fn(() => { events.push('refresh') })
  await expect(runSavedVaultOperation({
    editors, rootUri: 'saved-operation', refresh,
    run: async () => {
      expect(editors.generation()).toBe(1)
      events.push('fetch')
      throw new Error('offline')
    },
  })).rejects.toThrow('offline')
  expect(events).toEqual(['editor', 'disk', 'fetch', 'refresh'])
  expect(refresh).toHaveBeenCalledWith('note-one')
  expect(resume).not.toHaveBeenCalled()
})

it('keeps the draft mounted and resumes editing if its disk save fails', async () => {
  const editors = createWorkspaceSyncEditors()
  const resume = vi.fn()
  editors.register(async () => resume)
  let fail = true
  await persistWorkspaceOperations('failed-operation', [async () => { if (fail) throw new Error('disk full') }]).catch(() => {})
  const run = vi.fn()
  const refresh = vi.fn()
  await expect(runSavedVaultOperation({ editors, rootUri: 'failed-operation', run, refresh })).rejects.toThrow('disk full')
  expect(run).not.toHaveBeenCalled()
  expect(refresh).not.toHaveBeenCalled()
  expect(resume).toHaveBeenCalledOnce()
  expect(editors.generation()).toBe(0)
  fail = false
  await runSavedVaultOperation({ editors, rootUri: 'failed-operation', run, refresh })
  expect(run).toHaveBeenCalledOnce()
})
