import { expect, it } from 'vitest'
import { mobileWorkspaceKeyboardAction } from './mobileWorkspaceKeyboardShortcuts'

it('rejects object prototype names instead of treating them as keyboard actions', () => {
  for (const key of ['constructor', '__proto__', 'hasOwnProperty']) {
    expect(mobileWorkspaceKeyboardAction({ key, metaKey: true, ctrlKey: false, shiftKey: false, altKey: false })).toBeNull()
  }
})
