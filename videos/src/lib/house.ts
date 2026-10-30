import { Easing, interpolate } from 'remotion';

/** House ease-out `rf` (brand motion rules): cubic-bezier(0.22, 1, 0.36, 1). */
export const rf = Easing.bezier(0.22, 1, 0.36, 1);
/** Exits: rfIn (accelerating). */
export const rfIn = Easing.bezier(0.64, 0, 0.78, 0);
export const rfInOut = Easing.bezier(0.65, 0, 0.35, 1);

export const BRAND = {
  blue: '#155DFF',
  blue400: '#6E9EFF',
  blue50: '#F0F5FF',
  yellow: '#F0B100',
  dark: '#0F0F0F',
  red: '#FC203A',
  white: '#FFFFFF',
} as const;

/** Keyframed value with the house ease on every segment. */
export function keyed(frame: number, keys: Array<[number, number]>, easing = rf): number {
  if (frame <= keys[0][0]) return keys[0][1];
  for (let i = 1; i < keys.length; i++) {
    const [f1, v1] = keys[i];
    const [f0, v0] = keys[i - 1];
    if (frame <= f1) return interpolate(frame, [f0, f1], [v0, v1], { easing, extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  }
  return keys[keys.length - 1][1];
}

export const progress = (frame: number, start: number, duration: number, easing = rf) =>
  interpolate(frame, [start, start + duration], [0, 1], { easing, extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
