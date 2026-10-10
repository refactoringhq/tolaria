import { expect, it } from 'vitest'
import { withWorkspaceOperation } from './workspaceOperationQueue'

it('serializes one vault while allowing another vault to proceed', async () => {
  const events: string[] = []
  let release = () => {}
  const barrier = new Promise<void>((resolve) => { release = resolve })
  const first = withWorkspaceOperation('one', async () => {
    events.push('first')
    await barrier
  })
  const second = withWorkspaceOperation('one', async () => { events.push('second') })
  await withWorkspaceOperation('two', async () => { events.push('other') })
  expect(events).toEqual(['first', 'other'])
  release()
  await first
  await second
  expect(events).toEqual(['first', 'other', 'second'])
})

it('continues after a rejected operation without hiding the original failure', async () => {
  const failed = withWorkspaceOperation('failed', async () => { throw new Error('writeFailed') })
  const next = withWorkspaceOperation('failed', async () => 'saved')
  await expect(failed).rejects.toThrow('writeFailed')
  await expect(next).resolves.toBe('saved')
})
