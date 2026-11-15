import { describe, expect, it } from 'vitest'
import { collectionLayoutKey } from './collectionLayoutKey'

describe('collectionLayoutKey', () => {
  it('keeps vault-owned collection keys portable across machine paths', () => {
    expect(collectionLayoutKey({ kind: 'folder', path: 'clients', rootPath: '/Users/ada/vault' })).toBe('folder:clients')
    expect(collectionLayoutKey({ kind: 'folder', path: 'clients', rootPath: '/home/ada/vault' })).toBe('folder:clients')
  })

  it('uses stable keys for built-in and type collections', () => {
    expect(collectionLayoutKey({ kind: 'filter', filter: 'all' })).toBe('builtin:all')
    expect(collectionLayoutKey({ kind: 'sectionGroup', type: 'Project' })).toBe('type:Project')
  })
})
