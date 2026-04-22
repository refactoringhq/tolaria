import { describe, expect, it } from 'vitest'
import {
  GETTING_STARTED_VAULT_NAME,
  buildGettingStartedVaultPath,
  formatGettingStartedCloneError,
  isGettingStartedVaultPath,
  labelFromPath,
} from './gettingStartedVault'

describe('gettingStartedVault', () => {
  it('builds a child vault path from a parent folder', () => {
    expect(buildGettingStartedVaultPath('/Users/luca/Documents')).toBe('/Users/luca/Documents/Getting Started')
  })

  it('trims trailing separators when building the child vault path', () => {
    expect(buildGettingStartedVaultPath('/Users/luca/Documents/')).toBe('/Users/luca/Documents/Getting Started')
  })

  it('preserves windows separators when building the child vault path', () => {
    expect(buildGettingStartedVaultPath('C:\\Users\\luca\\Documents\\')).toBe('C:\\Users\\luca\\Documents\\Getting Started')
  })

  it('derives a label from the final path segment', () => {
    expect(labelFromPath('/Users/luca/Documents/Getting Started')).toBe(GETTING_STARTED_VAULT_NAME)
  })

  it('recognizes legacy starter vault aliases across machines', () => {
    expect(isGettingStartedVaultPath('/Volumes/Jupiter/Workspace/laputa-app/demo-vault-v2')).toBe(true)
    expect(isGettingStartedVaultPath('/Volumes/Jupiter/Workspace/laputa-app/demo-vault')).toBe(true)
  })

  it('recognizes the current resolved starter vault path', () => {
    expect(
      isGettingStartedVaultPath(
        '/Users/luca/Documents/Getting Started',
        '/Users/luca/Documents/Getting Started',
      ),
    ).toBe(true)
  })

  it('passes through destination errors verbatim', () => {
    expect(formatGettingStartedCloneError("Destination '/tmp/Getting Started' already exists and is not empty"))
      .toBe("Destination '/tmp/Getting Started' already exists and is not empty")
  })

  it('converts other clone failures into a friendly download message', () => {
    expect(formatGettingStartedCloneError('git clone failed: fatal: unable to access'))
      .toBe('Could not download Getting Started vault. Check your connection and try again.')
  })
})
