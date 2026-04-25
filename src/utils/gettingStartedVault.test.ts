import { describe, expect, it } from 'vitest'
import {
  GETTING_STARTED_VAULT_NAME,
  buildGettingStartedVaultPath,
  formatGettingStartedCloneError,
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

  it('passes through destination errors verbatim', () => {
    expect(formatGettingStartedCloneError("Destination '/tmp/Getting Started' already exists and is not empty"))
      .toBe("Destination '/tmp/Getting Started' already exists and is not empty")
  })

  it('maps git-not-found clone failures to an installation message', () => {
    expect(formatGettingStartedCloneError('Failed to run git clone: The system cannot find the file specified. (os error 2)'))
      .toBe('Git is required to download the Getting Started vault. Install Git and try again.')
  })

  it('maps concrete network clone failures to the connection message', () => {
    expect(formatGettingStartedCloneError('git clone failed: fatal: unable to access: Could not resolve host: github.com'))
      .toBe('Could not download Getting Started vault. Check your connection and try again.')
  })

  it('preserves unexpected clone failure details', () => {
    expect(formatGettingStartedCloneError('git clone failed: fatal: unable to access'))
      .toBe('Could not download Getting Started vault: git clone failed: fatal: unable to access')
  })
})
