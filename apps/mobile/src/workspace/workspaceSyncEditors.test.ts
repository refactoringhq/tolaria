import { expect, it, vi } from 'vitest'
import { createWorkspaceSyncEditors } from './workspaceSyncEditors'

it('resumes already-paused editors if another editor cannot prepare', async () => {
  const registry = createWorkspaceSyncEditors()
  const resume = vi.fn()
  registry.register(async () => resume)
  const removeBroken = registry.register(async () => { throw new Error('unreadable') })
  await expect(registry.prepare()).rejects.toThrow('unreadable')
  expect(resume).toHaveBeenCalledOnce()
  removeBroken()
  const release = await registry.prepare()
  release()
  release()
  expect(resume).toHaveBeenCalledTimes(2)
})
