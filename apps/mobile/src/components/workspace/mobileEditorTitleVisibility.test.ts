import { expect, it } from 'vitest'
import { shouldShowPhoneEditorTitle } from './mobileEditorTitleVisibility'

it('shows the floating title only after the document heading has scrolled away', () => {
  expect(shouldShowPhoneEditorTitle(0)).toBe(false)
  expect(shouldShowPhoneEditorTitle(140)).toBe(false)
  expect(shouldShowPhoneEditorTitle(141)).toBe(true)
})
