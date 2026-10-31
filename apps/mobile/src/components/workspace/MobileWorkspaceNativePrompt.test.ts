// @vitest-environment jsdom
import { act, createElement } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'

const nativePrompt = vi.hoisted(() => ({ prompt: vi.fn() }))
vi.mock('react-native', () => ({ Alert: { prompt: nativePrompt.prompt } }))

import { NativeSingleFieldPrompt } from './MobileWorkspaceNativePrompt'
import type { ActionContentProps } from './MobileWorkspaceActionSheet.types'

let root: ReturnType<typeof createRoot>
let host: HTMLDivElement
beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => { callback(0); return 1 })
  host = document.createElement('div')
  root = createRoot(host)
  nativePrompt.prompt.mockReset()
})
afterEach(async () => { await act(async () => root.unmount()); vi.unstubAllGlobals() })

it('opens the iOS create-folder prompt and submits through the existing field callback', async () => {
  const onFolderNameChange = vi.fn()
  const onCreateFolder = vi.fn()
  const props = {
    action: 'createFolder', folderName: 'New folder', typeDefinitions: {}, notes: [],
    onFolderNameChange, onCreateFolder, onClose: vi.fn(),
  } as unknown as ActionContentProps
  await act(async () => root.render(createElement(NativeSingleFieldPrompt, props)))
  expect(nativePrompt.prompt.mock.calls[0]?.[0]).toBe('Create folder')
  expect(nativePrompt.prompt.mock.calls[0]?.[4]).toBe('New folder')
  const buttons = nativePrompt.prompt.mock.calls[0]?.[2]
  buttons?.[1]?.onPress?.('Projects')
  expect(onFolderNameChange).toHaveBeenCalledWith('Projects')
  expect(onCreateFolder).toHaveBeenCalledOnce()
})

it('re-prompts a duplicate type with a localized validation message', async () => {
  const props = {
    action: 'createType', typeName: 'Project', typeDefinitions: { Project: {} }, notes: [],
    onTypeNameChange: vi.fn(), onCreateType: vi.fn(), onClose: vi.fn(),
  } as unknown as ActionContentProps
  await act(async () => root.render(createElement(NativeSingleFieldPrompt, props)))
  const buttons = nativePrompt.prompt.mock.calls[0]?.[2]
  buttons?.[1]?.onPress?.('project')
  expect(nativePrompt.prompt).toHaveBeenCalledTimes(2)
  expect(nativePrompt.prompt.mock.calls[1]?.[1]).toBe('An item with this name already exists.')
  expect(props.onCreateType).not.toHaveBeenCalled()
})
