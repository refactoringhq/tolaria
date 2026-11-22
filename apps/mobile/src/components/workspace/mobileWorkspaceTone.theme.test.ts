import { describe, expect, it } from 'vitest'
import { mobilePalettes } from '../../ui/theme/mobilePalette'
import { noteTypeColor, noteTypeSoftColor } from './mobileWorkspaceTone'

describe('typed note display colors', () => {
  it('uses the active palette without changing a note type or its stored definition', () => {
    expect(noteTypeColor('purple', mobilePalettes.dark)).toBe('#B196FF')
    expect(noteTypeSoftColor('purple', mobilePalettes.dark)).toBe('#2E2449')
    expect(noteTypeColor('gray', mobilePalettes.dark)).toBe('#AAA7A2')
    expect(noteTypeSoftColor('gray', mobilePalettes.dark)).toBe('#32302B')
    expect(noteTypeColor('purple')).toBe('#805AD5')
  })
})
