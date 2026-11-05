import { type PhoneWorkspaceState, phoneWorkspaceSidebarDrawerWidth } from './phoneWorkspaceTransitions'

const states: PhoneWorkspaceState[] = ['sidebar', 'list', 'editor', 'properties']
export type PhoneRailGeometry = { width: number; reduceMotion?: boolean }
export type PhoneRailBounds = { min: number; max: number; origin: PhoneWorkspaceState }
type PhoneRailSettlement = { offset: number; velocity: number; bounds: PhoneRailBounds; width: number }
type PhoneRailIntent = 'wait' | 'fail' | 'move'
type Movement = { x: number; y: number; dx: number; dy: number }

export function phoneRailOffset(state: PhoneWorkspaceState, width: number) {
  'worklet'
  const drawer = phoneWorkspaceSidebarDrawerWidth(width)
  return { sidebar: 0, list: -drawer, editor: -drawer - width, properties: -drawer - 2 * width }[state];
}

export function phoneRailFrame(state: PhoneWorkspaceState, width: number) {
  'worklet'
  return { left: -phoneRailOffset(state, width), width }
}

export function phoneRailNearestState(offset: number, width: number): PhoneWorkspaceState {
  'worklet'
  return states.reduce((nearest, candidate) => (
    Math.abs(offset - phoneRailOffset(candidate, width)) < Math.abs(offset - phoneRailOffset(nearest, width)) ? candidate : nearest
  ), states[0]);
}

export function phoneRailBounds(offset: number, width: number): PhoneRailBounds {
  'worklet'
  const origin = phoneRailNearestState(offset, width)
  const list = phoneRailOffset('list', width), editor = phoneRailOffset('editor', width), properties = phoneRailOffset('properties', width)
  if (Math.abs(offset - phoneRailOffset(origin, width)) >= 0.5) return { min: properties, max: 0, origin }
  const limits = {
    sidebar: { min: list, max: 0 }, list: { min: list, max: 0 },
    editor: { min: properties, max: list }, properties: { min: properties, max: editor },
  }[origin]
  return { min: Math.min(limits.min, offset), max: Math.max(limits.max, offset), origin }
}

export function phoneRailDragOffset(offset: number, dx: number, bounds: PhoneRailBounds) {
  'worklet'
  return Math.max(bounds.min, Math.min(bounds.max, offset + dx));
}

export function phoneRailSettleState(settlement: PhoneRailSettlement) {
  'worklet'
  const { offset, velocity, bounds, width } = settlement
  return phoneRailNearestState(phoneRailDragOffset(offset, velocity * 0.12, bounds), width);
}

export function phoneRailSettleDurationMs(velocity: number, reduceMotion = false) {
  'worklet'
  if (reduceMotion) return 0
  return Math.max(60, 180 - Math.min(120, Math.abs(velocity) * 0.08))
}

// Initialize helpers before dependent worklets capture them at module load.
const phoneRailEditorOwnsTouch = (geometry: PhoneRailGeometry, bounds: PhoneRailBounds, movement: Movement) => {
  'worklet'
  return bounds.origin === 'editor' && movement.x > 24 && movement.x < geometry.width - 24;
}

const phoneRailAxisIntent = (movement: Movement): PhoneRailIntent => {
  'worklet'
  const { dx, dy } = movement
  if (Math.abs(dy) > 12 && Math.abs(dy) >= Math.abs(dx)) return 'fail';
  return Math.abs(dx) >= 12 && Math.abs(dx) >= Math.abs(dy) * 1.4 ? 'move' : 'wait';
}

export const phoneRailIntent = (geometry: PhoneRailGeometry, offset: number, movement: Movement): PhoneRailIntent => {
  'worklet'
  const intent = phoneRailAxisIntent(movement)
  if (intent !== 'move') return intent;
  const bounds = phoneRailBounds(offset, geometry.width)
  if (phoneRailEditorOwnsTouch(geometry, bounds, movement)) return 'fail';
  return phoneRailDragOffset(offset, movement.dx, bounds) === offset ? 'fail' : 'move';
}
