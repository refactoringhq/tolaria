// @vitest-environment jsdom
import { act, createElement, useLayoutEffect } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { createEditorSaveGate } from '../workspace/editorSaveGate'
import { createWorkspaceSyncEditors, WorkspaceSyncEditorsContext } from '../workspace/workspaceSyncEditors'
import { useEditorModeSwitch } from './useEditorModeSwitch'

let root: ReturnType<typeof createRoot>
let current: ReturnType<typeof useEditorModeSwitch> | undefined
const changeMode = vi.fn()

function Harness({ noteId }: { noteId: string }) {
  const value = useEditorModeSwitch(noteId, changeMode)
  useLayoutEffect(() => { current = value }, [value])
  return null
}

function render(editors: ReturnType<typeof createWorkspaceSyncEditors>, noteId: string) {
  return act(async () => root.render(createElement(WorkspaceSyncEditorsContext.Provider, { value: editors },
    createElement(Harness, { noteId }))))
}

async function toggle() {
  await act(async () => {
    current?.toggle()
    await new Promise((resolve) => setTimeout(resolve, 0))
  })
}

function pausedByAnotherOperation() {
  const editors = createWorkspaceSyncEditors()
  const gate = createEditorSaveGate({ read: async () => 'body', commit: () => {}, setEditable: () => {} })
  editors.register(gate.prepare, 'note-a')
  return { editors, holdPause: () => gate.prepare() }
}

beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  changeMode.mockClear()
  current = undefined
  root = createRoot(document.createElement('div'))
})
afterEach(async () => {
  await act(async () => root.unmount())
  vi.unstubAllGlobals()
})

it('reports a held editor pause as the raw-editor failure without reading the note', async () => {
  const { editors, holdPause } = pausedByAnotherOperation()
  await render(editors, 'note-a')
  await holdPause()

  await toggle()

  expect(changeMode).not.toHaveBeenCalled()
  expect(current?.failed).toBe(true)
})

it('keeps the failure banner while the same note stays open and clears it after opening another note', async () => {
  const { editors, holdPause } = pausedByAnotherOperation()
  await render(editors, 'note-a')
  await holdPause()
  await toggle()

  await render(editors, 'note-a')
  expect(current?.failed).toBe(true)

  await render(editors, 'note-b')
  expect(current?.failed).toBe(false)
})

it('switches modes and clears the banner once the other operation releases its pause', async () => {
  const { editors, holdPause } = pausedByAnotherOperation()
  await render(editors, 'note-a')
  const release = await holdPause()
  await toggle()
  expect(current?.failed).toBe(true)

  release()
  await toggle()

  expect(changeMode).toHaveBeenCalledTimes(1)
  expect(current?.failed).toBe(false)
})
