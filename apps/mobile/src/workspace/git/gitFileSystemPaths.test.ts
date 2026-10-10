import { expect, it } from 'vitest'
import { gitFileUri } from './gitFileSystemPaths'

it('keeps Git paths inside an app-owned root, including literal percent escapes', () => {
  const root = 'file:///private/app/My%20Vault/'
  expect(gitFileUri(root, '/vault')).toBe(root)
  expect(gitFileUri(root, '/vault/notes/a b.md')).toBe(`${root}notes/a%20b.md`)
  expect(gitFileUri(root, '/vault/%2e%2e')).toBe(`${root}%252e%252e`)
  for (const path of ['/vault/../secret', '/other', '/vault2/file', '/vault/a\\b', '/vault/a\0b']) {
    expect(() => gitFileUri(root, path)).toThrow('outsideGitVault')
  }
  expect(() => gitFileUri('content://provider/vault', '/vault')).toThrow('unsupportedGitStorage')
})
