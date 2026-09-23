import { describe, expect, it } from 'vitest'
import { availableViewFields } from './useAppViewActions'

describe('availableViewFields', () => {
  it('offers archived as a built-in saved-view field', () => {
    expect(availableViewFields([])).toContain('archived')
  })
})
