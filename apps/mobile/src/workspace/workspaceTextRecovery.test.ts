import { expect, it, vi } from 'vitest'
import { recoverNativeWorkspaceText, writeNativeWorkspaceText } from './workspaceTextRecovery'

it('uses the native atomic writer without falling back after a rejected save', async () => {
  const writeWorkspaceText = vi.fn(async () => {})
  const module = { writeWorkspaceText, recoverWorkspaceText: vi.fn(() => false) }
  await expect(writeNativeWorkspaceText('file:///vault', 'note.md', 'draft', module)).resolves.toBeUndefined()
  expect(writeWorkspaceText).toHaveBeenCalledWith('file:///vault', 'note.md', 'draft')
  writeWorkspaceText.mockRejectedValue(new Error('externalChange'))
  await expect(writeNativeWorkspaceText('file:///vault', 'note.md', 'newer', module)).rejects.toThrow('externalChange')
})

it('distinguishes unavailable native support from a failed recovery', () => {
  expect(writeNativeWorkspaceText('file:///vault', 'note.md', 'draft', null)).toBeNull()
  expect(recoverNativeWorkspaceText('file:///vault', null)).toBe(false)
  const recoverWorkspaceText = vi.fn(() => true)
  expect(recoverNativeWorkspaceText('file:///vault', { recoverWorkspaceText })).toBe(true)
  expect(recoverWorkspaceText).toHaveBeenCalledWith('file:///vault')
  recoverWorkspaceText.mockImplementation(() => { throw new Error('invalidRecord') })
  expect(() => recoverNativeWorkspaceText('file:///vault', { recoverWorkspaceText })).toThrow('invalidRecord')
})

it('does not send Git virtual paths to a native filesystem', () => {
  const recoverWorkspaceText = vi.fn(() => true)
  expect(recoverNativeWorkspaceText('/vault', { recoverWorkspaceText })).toBe(false)
  expect(recoverWorkspaceText).not.toHaveBeenCalled()
})

it('does not silently downgrade an outdated standalone native module', () => {
  expect(() => writeNativeWorkspaceText('file:///vault', 'note.md', 'draft', {})).toThrow('nativeTextRecoveryUnavailable')
  expect(() => recoverNativeWorkspaceText('file:///vault', {})).toThrow('nativeTextRecoveryUnavailable')
})
