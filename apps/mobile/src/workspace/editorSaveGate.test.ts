import { expect, it, vi } from 'vitest'
import { createEditorSaveGate } from './editorSaveGate'

it('invalidates an in-flight autosave before freezing and reading the final document', async () => {
  let finishOldRead: (value: string) => void = () => {}
  const oldRead = new Promise<string>((resolve) => { finishOldRead = resolve })
  const read = vi.fn().mockReturnValueOnce(oldRead).mockResolvedValue('final')
  const commit = vi.fn()
  const setEditable = vi.fn()
  const gate = createEditorSaveGate({ read, commit, setEditable })
  const oldSave = gate.save()
  const resume = await gate.prepare()
  finishOldRead('stale')
  await oldSave
  await gate.save()
  expect(commit.mock.calls).toEqual([['final']])
  expect(setEditable.mock.calls).toEqual([[false]])
  resume()
  expect(setEditable.mock.calls).toEqual([[false], [true]])
})

it('restores editing and propagates a failed final read instead of allowing sync', async () => {
  const setEditable = vi.fn()
  const gate = createEditorSaveGate({ read: async () => { throw new Error('bridgeUnavailable') }, commit: vi.fn(), setEditable })
  await expect(gate.prepare()).rejects.toThrow('bridgeUnavailable')
  expect(setEditable.mock.calls).toEqual([[false], [true]])
})

it('never applies autosave responses out of order', async () => {
  let finishFirst: (value: string) => void = () => {}
  const first = new Promise<string>((resolve) => { finishFirst = resolve })
  const commit = vi.fn()
  const gate = createEditorSaveGate({ read: vi.fn().mockReturnValueOnce(first).mockResolvedValue('newer'), commit, setEditable: vi.fn() })
  const oldSave = gate.save()
  await gate.save()
  finishFirst('older')
  await oldSave
  expect(commit.mock.calls).toEqual([['newer']])
})

it('prevents a second preparation until the first has resumed', async () => {
  const gate = createEditorSaveGate({ read: async () => 'document', commit: vi.fn(), setEditable: vi.fn() })
  const resume = await gate.prepare()
  await expect(gate.prepare()).rejects.toThrow('editorAlreadyPaused')
  resume()
  resume()
  await gate.prepare()
  resume()
  await expect(gate.prepare()).rejects.toThrow('editorAlreadyPaused')
})
