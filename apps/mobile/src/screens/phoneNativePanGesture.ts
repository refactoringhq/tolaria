import { Gesture, type GestureStateManager, type GestureTouchEvent } from 'react-native-gesture-handler'
import { cancelAnimation, runOnJS, type SharedValue, withTiming } from 'react-native-reanimated'
import {
  type PhoneRailBounds, type PhoneRailGeometry,
  phoneRailBounds, phoneRailDragOffset, phoneRailIntent, phoneRailOffset,
  phoneRailSettleDurationMs, phoneRailSettleState,
} from './phonePanelRail'
import type { PhoneWorkspaceState } from './phoneWorkspaceTransitions'

export type PhonePanSession = {
  x: number; y: number; base: number; translation: number
  mode: 'wait' | 'fail' | 'move'; bounds: PhoneRailBounds
}
type TraceDetails = {
  absoluteX?: number; absoluteY?: number; translationX?: number; translationY?: number
  velocityX?: number; success?: boolean; ticket?: number; target?: PhoneWorkspaceState; pointers?: number
}
export type PhonePanTrace = PhonePanSession & TraceDetails & {
  phase: 'down' | 'intent' | 'start' | 'end' | 'finalize' | 'settle' | 'settled'
  offset: number; width: number; epoch: number; at: number
}
type Options = {
  geometry: SharedValue<PhoneRailGeometry>
  offset: SharedValue<number>
  epoch: SharedValue<number>
  session: SharedValue<PhonePanSession>
  onSettle: (state: PhoneWorkspaceState, epoch: number) => void
  onTrace?: (event: PhonePanTrace) => void
}

// Dependent worklets capture helpers when the module initializes.
function tracePhonePan(options: Options, phase: PhonePanTrace['phase'], details: TraceDetails = {}) {
  'worklet'
  if (!options.onTrace) return
  runOnJS(options.onTrace)({
    ...options.session.value, ...details, phase, at: Date.now(),
    offset: options.offset.value, epoch: options.epoch.value, width: options.geometry.value.width,
  })
}

export function createPhonePanGesture(options: Options) {
  const { geometry, offset, epoch, session } = options
  return Gesture.Pan().maxPointers(1).manualActivation(true)
    .onTouchesDown((event, manager) => preparePhonePan(options, event, manager))
    .onTouchesMove((event, manager) => recognizePhonePan(options, event, manager))
    .onStart((event) => {
      epoch.value += 1
      cancelAnimation(offset)
      session.value = { ...session.value, base: offset.value, translation: event.translationX,
        bounds: phoneRailBounds(offset.value, geometry.value.width) }
      tracePhonePan(options, 'start', { translationX: event.translationX })
    })
    .onUpdate((event) => {
      if (session.value.mode !== 'move') return
      offset.value = phoneRailDragOffset(session.value.base, event.translationX - session.value.translation, session.value.bounds)
    })
    .onEnd((event) => {
      tracePhonePan(options, 'end', { translationX: event.translationX, velocityX: event.velocityX })
      if (session.value.mode !== 'move') return
      settlePhonePan(options, phoneRailSettleState({ offset: offset.value, velocity: event.velocityX,
        bounds: session.value.bounds, width: geometry.value.width }), event.velocityX)
    })
    .onFinalize((_, success) => {
      tracePhonePan(options, 'finalize', { success })
      if (!success && session.value.mode === 'move') settlePhonePan(options, session.value.bounds.origin)
    })
}

function preparePhonePan(options: Options, event: GestureTouchEvent, manager: GestureStateManager) {
  'worklet'
  const { geometry, offset, session } = options
  const touch = event.allTouches[0]
  if (!touch || event.allTouches.length !== 1) {
    tracePhonePan(options, 'down', { success: false, pointers: event.allTouches.length })
    manager.fail(); return
  }
  session.value = { x: touch.x, y: touch.y, base: offset.value, translation: 0,
    mode: 'wait', bounds: phoneRailBounds(offset.value, geometry.value.width) }
  tracePhonePan(options, 'down', { absoluteX: touch.absoluteX, absoluteY: touch.absoluteY, pointers: 1 })
}

function recognizePhonePan(options: Options, event: GestureTouchEvent, manager: GestureStateManager) {
  'worklet'
  const { geometry, offset, session } = options
  if (session.value.mode !== 'wait') return
  const touch = event.allTouches[0]
  if (!touch) return
  const start = session.value
  const mode = phoneRailIntent(geometry.value, offset.value,
    { x: start.x, y: start.y, dx: touch.x - start.x, dy: touch.y - start.y })
  session.value = { ...start, mode }
  if (mode !== 'wait') tracePhonePan(options, 'intent', {
    translationX: touch.x - start.x, translationY: touch.y - start.y,
  })
  if (mode === 'fail') manager.fail()
  else if (mode === 'move') manager.activate()
}

function settlePhonePan(options: Options, state: PhoneWorkspaceState, velocity = 0) {
  'worklet'
  const { geometry, offset, epoch, session, onSettle } = options
  const ticket = epoch.value
  session.value = { ...session.value, mode: 'fail' }
  tracePhonePan(options, 'settle', { target: state, ticket })
  offset.value = withTiming(phoneRailOffset(state, geometry.value.width),
    { duration: phoneRailSettleDurationMs(velocity, geometry.value.reduceMotion) }, (finished) => {
      tracePhonePan(options, 'settled', { success: Boolean(finished && epoch.value === ticket), ticket, target: state })
      if (finished && epoch.value === ticket) runOnJS(onSettle)(state, ticket)
    })
}
