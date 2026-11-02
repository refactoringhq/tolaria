export type MobileNoteSwipeAction = 'favorite' | 'archive'
export const mobileNoteSwipeThreshold = 0.68

export function fullSwipeNoteAction(distance: number, width: number): MobileNoteSwipeAction | null {
  'worklet'
  if (width <= 0 || distance > -width * mobileNoteSwipeThreshold) return null
  return 'archive'
}
