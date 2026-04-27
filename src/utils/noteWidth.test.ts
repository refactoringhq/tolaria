import {
  DEFAULT_NOTE_WIDTH_MODE,
  normalizeNoteWidthMode,
  resolveNoteWidthMode,
  toggleNoteWidthMode,
} from './noteWidth'

describe('noteWidth', () => {
  it('normalizes known width modes', () => {
    expect(normalizeNoteWidthMode('normal')).toBe('normal')
    expect(normalizeNoteWidthMode(' Wide ')).toBe('wide')
  })

  it('rejects unknown width modes', () => {
    expect(normalizeNoteWidthMode('narrow')).toBeNull()
    expect(normalizeNoteWidthMode(null)).toBeNull()
  })

  it('prefers per-note width before default settings', () => {
    expect(resolveNoteWidthMode('wide', 'normal')).toBe('wide')
    expect(resolveNoteWidthMode(null, 'wide')).toBe('wide')
    expect(resolveNoteWidthMode('invalid', 'invalid')).toBe(DEFAULT_NOTE_WIDTH_MODE)
  })

  it('toggles between normal and wide', () => {
    expect(toggleNoteWidthMode('normal')).toBe('wide')
    expect(toggleNoteWidthMode('wide')).toBe('normal')
  })
})
