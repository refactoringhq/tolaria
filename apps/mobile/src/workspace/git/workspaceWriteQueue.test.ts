import { expect, it, vi } from 'vitest'
import { persistWorkspaceOperations, withSavedWorkspace } from './workspaceWriteQueue'

it('finishes pending writes before allowing checkout', async () => {
  const events: string[] = []
  let release = () => {}
  const pause = new Promise<void>((resolve) => { release = resolve })
  const write = persistWorkspaceOperations('write-before-sync', [async () => {
    events.push('write-start')
    await pause
    events.push('write-end')
  }])
  const sync = withSavedWorkspace('write-before-sync', async () => { events.push('checkout') })
  await Promise.resolve()
  expect(events).not.toContain('checkout')
  release()
  await write
  await sync
  expect(events).toEqual(['write-start', 'write-end', 'checkout'])
})

it('blocks sync on a failed write and retries without replaying successful mutations', async () => {
  const moved = vi.fn()
  let writable = false
  const save = vi.fn(() => { if (!writable) throw new Error('diskFull') })
  const checkout = vi.fn(async () => 'synced')
  await expect(persistWorkspaceOperations('failed-save', [moved, save])).rejects.toThrow('diskFull')
  await expect(withSavedWorkspace('failed-save', checkout)).rejects.toThrow('diskFull')
  expect(checkout).not.toHaveBeenCalled()
  writable = true
  await expect(withSavedWorkspace('failed-save', checkout)).resolves.toBe('synced')
  expect(moved).toHaveBeenCalledTimes(1)
  expect(save).toHaveBeenCalledTimes(3)
})

it('preserves newer edits after a failed write instead of retrying stale content last', async () => {
  let writable = false
  let content = ''
  await expect(persistWorkspaceOperations('ordered-retry', [() => {
    if (!writable) throw new Error('offlineProvider')
    content = 'old'
  }])).rejects.toThrow('offlineProvider')
  writable = true
  await persistWorkspaceOperations('ordered-retry', [() => { content = 'new' }])
  await withSavedWorkspace('ordered-retry', async () => { expect(content).toBe('new') })
})

it('queues writes arriving during a Git operation until that operation finishes', async () => {
  const events: string[] = []
  let release = () => {}
  const pause = new Promise<void>((resolve) => { release = resolve })
  const sync = withSavedWorkspace('exclusive-sync', async () => {
    events.push('sync-start')
    await pause
    events.push('sync-end')
  })
  const write = persistWorkspaceOperations('exclusive-sync', [() => { events.push('write') }])
  release()
  await sync
  await write
  expect(events).toEqual(['sync-start', 'sync-end', 'write'])
})
