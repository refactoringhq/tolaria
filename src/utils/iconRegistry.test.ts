import { describe, it, expect } from 'vitest'
import { resolveIcon, ICON_OPTIONS } from './iconRegistry'
import { FileText, GearSix, CookingPot } from '@phosphor-icons/react'

describe('resolveIcon', () => {
  it('returns FileText for null', () => {
    expect(resolveIcon(null)).toBe(FileText)
  })

  it('returns FileText for unknown icon name', () => {
    expect(resolveIcon('nonexistent-icon')).toBe(FileText)
  })

  it('resolves gear-six to GearSix', () => {
    expect(resolveIcon('gear-six')).toBe(GearSix)
  })

  it('resolves cooking-pot to CookingPot', () => {
    expect(resolveIcon('cooking-pot')).toBe(CookingPot)
  })
})

describe('ICON_OPTIONS', () => {
  it('includes gear-six', () => {
    expect(ICON_OPTIONS.some((o) => o.name === 'gear-six')).toBe(true)
  })
})
