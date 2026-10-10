import { Gesture } from 'react-native-gesture-handler'
import { cancelAnimation, runOnJS, withSpring, type SharedValue } from 'react-native-reanimated'
import { desktopPanelParity } from '../ui/desktopParity'
import { tabletPanelGestureIntent, type TabletDragIntent } from './tabletPanelGestureIntent'
import { tabletLeftPanelStageAfterDrag, tabletLeftPanelStageOffset, type TabletLeftPanelStage } from './tabletWorkspacePanelTransitions'

export const tabletPanelSpring = { damping: 26, mass: 0.8, overshootClamping: true, stiffness: 280 }
export type TabletPanelPosition = { stage: TabletLeftPanelStage; propertiesVisible: boolean }
export type TabletPanelMotion = {
  left: SharedValue<number>
  properties: SharedValue<number>
  restoreLeft: SharedValue<number>
}
export type TabletPanSession = {
  x: number
  y: number
  left: number
  properties: number
  mode: TabletDragIntent
}
type PanOptions = {
  compactTablet: boolean
  propertiesReplaceSidebar: boolean
  width: number
  motion: TabletPanelMotion
  session: SharedValue<TabletPanSession>
  onSettle: (position: TabletPanelPosition) => void
}

export function createTabletPanGesture(options: PanOptions) {
  const { compactTablet, motion, session, width } = options
  const minimumLeft = tabletLeftPanelStageOffset('editor', compactTablet)
  return Gesture.Pan().maxPointers(1).manualActivation(true)
    .onTouchesDown((event) => {
      const touch = event.allTouches[0]
      if (!touch) return
      session.value = { x: touch.x, y: touch.y, left: motion.left.value, properties: motion.properties.value, mode: 'wait' }
    })
    .onTouchesMove((event, manager) => {
      if (session.value.mode !== 'wait') return
      const touch = event.allTouches[0]
      if (!touch) return
      const intent = tabletPanelGestureIntent(
        { width, minimumLeft, left: motion.left.value, properties: motion.properties.value },
        { x: session.value.x, dx: touch.x - session.value.x, dy: touch.y - session.value.y },
      )
      session.value = { ...session.value, mode: intent }
      if (intent === 'fail') manager.fail()
      else if (intent !== 'wait') manager.activate()
    })
    .onStart(() => beginTabletPan(options))
    .onUpdate((event) => updateTabletPan(options, event.translationX))
    .onEnd((event) => settleTabletPan(options, event.velocityX / 1000))
    .onFinalize((_, success) => {
      if (!success && isActivePan(session.value.mode)) settleTabletPan(options, 0)
    })
}

function isActivePan(mode: TabletDragIntent) {
  'worklet'
  return mode === 'left' || mode === 'properties'
}

function beginTabletPan({ motion, session, propertiesReplaceSidebar }: PanOptions) {
  'worklet'
  cancelAnimation(motion.left)
  cancelAnimation(motion.properties)
  session.value = { ...session.value, left: motion.left.value, properties: motion.properties.value }
  if (session.value.mode === 'properties' && motion.properties.value >= desktopPanelParity.inspectorWidth) {
    motion.restoreLeft.value = motion.left.value
  }
  if (session.value.mode === 'left' && propertiesReplaceSidebar) {
    motion.properties.value = withSpring(desktopPanelParity.inspectorWidth, tabletPanelSpring)
  }
}

function updateTabletPan({ motion, session, compactTablet, propertiesReplaceSidebar }: PanOptions, dx: number) {
  'worklet'
  const minimum = tabletLeftPanelStageOffset('editor', compactTablet)
  if (session.value.mode === 'left') {
    motion.left.value = Math.max(minimum, Math.min(0, session.value.left + dx))
    return
  }
  const panelWidth = desktopPanelParity.inspectorWidth
  motion.properties.value = Math.max(0, Math.min(panelWidth, session.value.properties + dx))
  if (propertiesReplaceSidebar) {
    const progress = 1 - motion.properties.value / panelWidth
    motion.left.value = motion.restoreLeft.value + (minimum - motion.restoreLeft.value) * progress
  }
}

function settledLeftOffset({ compactTablet, motion, propertiesReplaceSidebar, session }: PanOptions, visible: boolean) {
  'worklet'
  if (!propertiesReplaceSidebar || session.value.mode !== 'properties') return motion.left.value
  return visible ? tabletLeftPanelStageOffset('editor', compactTablet) : motion.restoreLeft.value
}

function settleTabletPan(options: PanOptions, velocity: number) {
  'worklet'
  const { motion, compactTablet, session, onSettle } = options
  const panelWidth = desktopPanelParity.inspectorWidth
  const projectedProperties = motion.properties.value + velocity * 200
  const visible = session.value.mode === 'properties'
    ? projectedProperties < panelWidth / 2
    : !options.propertiesReplaceSidebar && motion.properties.value < panelWidth / 2
  const targetLeft = settledLeftOffset(options, visible)
  const stage = tabletLeftPanelStageAfterDrag({ compactTablet, stage: 'all', startOffset: targetLeft, dx: 0, vx: session.value.mode === 'left' ? velocity : 0 })
  motion.left.value = withSpring(tabletLeftPanelStageOffset(stage, compactTablet), tabletPanelSpring)
  motion.properties.value = withSpring(visible ? 0 : panelWidth, tabletPanelSpring)
  runOnJS(onSettle)({ stage, propertiesVisible: visible })
}
