import { describe, expect, it } from 'vitest'
import { fullSwipeNoteAction } from './mobileNoteSwipe'

describe('note row full swipe', () => {
  it('reveals buttons without committing on partial swipes', () => {
    expect(fullSwipeNoteAction(120, 340)).toBeNull()
    expect(fullSwipeNoteAction(-150, 340)).toBeNull()
  })

  it('reserves right swipes for navigation and only commits archive on a full left swipe', () => {
    expect(fullSwipeNoteAction(260, 340)).toBeNull()
    expect(fullSwipeNoteAction(-260, 340)).toBe('archive')
    expect(fullSwipeNoteAction(-1000, 340)).toBe('archive')
  })

  it('scales the threshold with the measured row and waits for layout', () => {
    expect(fullSwipeNoteAction(260, 600)).toBeNull()
    expect(fullSwipeNoteAction(450, 600)).toBeNull()
    expect(fullSwipeNoteAction(-450, 600)).toBe('archive')
    expect(fullSwipeNoteAction(450, 0)).toBeNull()
  })
})
