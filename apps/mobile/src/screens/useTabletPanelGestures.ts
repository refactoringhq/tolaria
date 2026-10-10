import { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { PanResponder, type PanResponderGestureState, useWindowDimensions } from 'react-native'
import {
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  type SharedValue,
} from 'react-native-reanimated'
import { desktopPanelParity } from '../ui/desktopParity'
import { horizontalSwipeCapturesMovement } from '../ui/horizontalSwipePolicy'
import {
  tabletLeftPanelDragOffset,
  tabletLeftPanelStageAfterDrag,
  tabletLeftPanelStageOffset,
  tabletPropertiesDragOffset,
  tabletPropertiesVisibleAfterDrag,
  tabletWorkspaceDragMode,
  type TabletLeftPanelStage,
  type TabletWorkspaceDragMode,
} from './tabletWorkspacePanelTransitions'

export type TabletPanelGestureOptions = {
  compactTablet: boolean
  defaultPropertiesVisible: boolean
  defaultSidebarVisible: boolean
  exclusiveSidePanels: boolean
  propertiesReplaceSidebar: boolean
}

const panelSpring = {
  damping: 26,
  mass: 0.8,
  overshootClamping: true,
  stiffness: 280,
}

function setDirectOffset(offset: SharedValue<number>, value: number) {
  cancelAnimation(offset)
  offset.value = value
}

function settleOffset(offset: SharedValue<number>, value: number) {
  offset.value = withSpring(value, panelSpring)
}

function normalizedLeftStage(stage: TabletLeftPanelStage, compactTablet: boolean) {
  return compactTablet && stage === 'all' ? 'list' : stage
}

function useLeftPanelMotion(initialStage: TabletLeftPanelStage, compactTablet: boolean) {
  const [stage, setStage] = useState(() => normalizedLeftStage(initialStage, compactTablet))
  const offset = useSharedValue(tabletLeftPanelStageOffset(stage, compactTablet))
  const dragOffset = useRef(tabletLeftPanelStageOffset(stage, compactTablet))

  const settle = useCallback((nextStage: TabletLeftPanelStage) => {
    const normalized = normalizedLeftStage(nextStage, compactTablet)
    setStage(normalized)
    settleOffset(offset, tabletLeftPanelStageOffset(normalized, compactTablet))
  }, [compactTablet, offset])

  const motionStyle = useAnimatedStyle(() => ({
    marginRight: offset.value,
    transform: [{ translateX: offset.value }],
  }))

  return {
    beginDrag: useCallback(() => {
      cancelAnimation(offset)
      dragOffset.current = offset.value
      return stage
    }, [offset, stage]),
    canDrag: useCallback((dx: number) => {
      const current = offset.value
      const minimum = tabletLeftPanelStageOffset('editor', compactTablet)
      return (dx < 0 && current > minimum) || (dx > 0 && current < 0)
    }, [compactTablet, offset]),
    drag: useCallback((dx: number, startStage: TabletLeftPanelStage) => {
      setDirectOffset(offset, tabletLeftPanelDragOffset({ compactTablet, dx, stage: startStage, startOffset: dragOffset.current }))
    }, [compactTablet, offset]),
    finishDrag: useCallback((dx: number, vx: number, startStage: TabletLeftPanelStage) => {
      settle(tabletLeftPanelStageAfterDrag({ compactTablet, dx, stage: startStage, startOffset: dragOffset.current, vx }))
    }, [compactTablet, settle]),
    motionStyle,
    offset,
    settle,
    stage,
  }
}

type LeftPanelMotion = ReturnType<typeof useLeftPanelMotion>

function usePropertiesPanelMotion({
  compactTablet,
  defaultPropertiesVisible,
  leftPanels,
  propertiesReplaceSidebar,
  restoreStage,
}: {
  compactTablet: boolean
  defaultPropertiesVisible: boolean
  leftPanels: LeftPanelMotion
  propertiesReplaceSidebar: boolean
  restoreStage: TabletLeftPanelStage
}) {
  const panelWidth = desktopPanelParity.inspectorWidth
  const [visible, setVisible] = useState(defaultPropertiesVisible)
  const offset = useSharedValue(defaultPropertiesVisible ? 0 : panelWidth)
  const restoreStageRef = useRef(normalizedLeftStage(restoreStage, compactTablet))
  const dragVisibleRef = useRef(visible)
  const dragRestoreStageRef = useRef(normalizedLeftStage(restoreStage, compactTablet))
  const actions = usePropertiesPanelActions({
    leftPanels,
    offset,
    panelWidth,
    propertiesReplaceSidebar,
    restoreStageRef,
    setVisible,
    visible,
  })
  const drag = usePropertiesPanelDrag({
    actions,
    compactTablet,
    dragRestoreStageRef,
    dragVisibleRef,
    leftPanels,
    offset,
    panelWidth,
    propertiesReplaceSidebar,
    restoreStageRef,
    visible,
  })
  const motionStyle = useAnimatedStyle(() => ({
    marginLeft: -offset.value,
    transform: [{ translateX: offset.value }],
  }))

  return {
    ...actions,
    ...drag,
    motionStyle,
    visible,
  }
}

type PropertiesStageRef = { current: TabletLeftPanelStage }
type PropertiesVisibleRef = { current: boolean }

function usePropertiesPanelActions({
  leftPanels,
  offset,
  panelWidth,
  propertiesReplaceSidebar,
  restoreStageRef,
  setVisible,
  visible,
}: {
  leftPanels: LeftPanelMotion
  offset: SharedValue<number>
  panelWidth: number
  propertiesReplaceSidebar: boolean
  restoreStageRef: PropertiesStageRef
  setVisible: (visible: boolean) => void
  visible: boolean
}) {
  const hide = useCallback((restoreLeftPanels = true) => {
    setVisible(false)
    settleOffset(offset, panelWidth)
    if (propertiesReplaceSidebar && restoreLeftPanels) leftPanels.settle(restoreStageRef.current)
  }, [leftPanels, offset, panelWidth, propertiesReplaceSidebar, restoreStageRef, setVisible])
  const show = useCallback(() => {
    if (!visible && propertiesReplaceSidebar) restoreStageRef.current = leftPanels.stage
    setVisible(true)
    settleOffset(offset, 0)
    if (propertiesReplaceSidebar) leftPanels.settle('editor')
  }, [leftPanels, offset, propertiesReplaceSidebar, restoreStageRef, setVisible, visible])

  return { hide, show }
}

type PropertiesPanelActions = ReturnType<typeof usePropertiesPanelActions>

function usePropertiesPanelDrag({
  actions,
  compactTablet,
  dragRestoreStageRef,
  dragVisibleRef,
  leftPanels,
  offset,
  panelWidth,
  propertiesReplaceSidebar,
  restoreStageRef,
  visible,
}: {
  actions: PropertiesPanelActions
  compactTablet: boolean
  dragRestoreStageRef: PropertiesStageRef
  dragVisibleRef: PropertiesVisibleRef
  leftPanels: LeftPanelMotion
  offset: SharedValue<number>
  panelWidth: number
  propertiesReplaceSidebar: boolean
  restoreStageRef: PropertiesStageRef
  visible: boolean
}) {
  const beginDrag = useCallback(() => {
    cancelAnimation(offset)
    dragVisibleRef.current = visible
    if (!visible && propertiesReplaceSidebar) restoreStageRef.current = leftPanels.stage
    dragRestoreStageRef.current = restoreStageRef.current
  }, [dragRestoreStageRef, dragVisibleRef, leftPanels.stage, offset, propertiesReplaceSidebar, restoreStageRef, visible])
  const drag = useCallback((dx: number) => {
    const nextOffset = tabletPropertiesDragOffset({ dx, visible: dragVisibleRef.current })
    setDirectOffset(offset, nextOffset)
    updateLeftPanelsDuringPropertiesDrag({
      compactTablet,
      leftPanels,
      nextOffset,
      panelWidth,
      propertiesReplaceSidebar,
      restoreStage: dragRestoreStageRef.current,
    })
  }, [compactTablet, dragRestoreStageRef, dragVisibleRef, leftPanels, offset, panelWidth, propertiesReplaceSidebar])
  const finishDrag = useCallback((dx: number, vx: number) => {
    const nextVisible = tabletPropertiesVisibleAfterDrag({ dx, visible: dragVisibleRef.current, vx })
    if (nextVisible) actions.show()
    else actions.hide()
  }, [actions, dragVisibleRef])

  return { beginDrag, drag, finishDrag }
}

function updateLeftPanelsDuringPropertiesDrag({
  compactTablet,
  leftPanels,
  nextOffset,
  panelWidth,
  propertiesReplaceSidebar,
  restoreStage,
}: {
  compactTablet: boolean
  leftPanels: LeftPanelMotion
  nextOffset: number
  panelWidth: number
  propertiesReplaceSidebar: boolean
  restoreStage: TabletLeftPanelStage
}) {
  if (!propertiesReplaceSidebar) return
  const restoreOffset = tabletLeftPanelStageOffset(restoreStage, compactTablet)
  const editorOffset = tabletLeftPanelStageOffset('editor', compactTablet)
  const openProgress = 1 - nextOffset / panelWidth
  setDirectOffset(leftPanels.offset, restoreOffset + (editorOffset - restoreOffset) * openProgress)
}

type PropertiesPanelMotion = ReturnType<typeof usePropertiesPanelMotion>

function useWorkspacePanHandlers({
  leftPanels,
  properties,
}: {
  leftPanels: LeftPanelMotion
  properties: PropertiesPanelMotion
}) {
  const { width } = useWindowDimensions()
  const responder = useMemo(() => createWorkspacePanController(), [])
  useLayoutEffect(() => {
    responder.setContext({ leftPanels, properties, width })
  }, [leftPanels, properties, responder, width])
  return responder.panHandlers
}

type WorkspacePanContext = {
  leftPanels: LeftPanelMotion
  properties: PropertiesPanelMotion
  width: number
}

function createWorkspacePanController() {
  let context: WorkspacePanContext | null = null
  return {
    panHandlers: createWorkspacePanHandlers(() => context),
    setContext: (next: WorkspacePanContext) => { context = next },
  }
}

function createWorkspacePanHandlers(readContext: () => WorkspacePanContext | null) {
  let session: { mode: TabletWorkspaceDragMode; stage: TabletLeftPanelStage } | null = null
  return PanResponder.create({
    onMoveShouldSetPanResponderCapture: (_, gesture) => {
      if (!horizontalSwipeCapturesMovement(gesture)) return false
      const context = readContext()
      if (!context) return false
      const { leftPanels, properties, width } = context
      const mode = workspaceDragMode(gesture, properties.visible, width)
      if (mode === 'left' && !leftPanels.canDrag(gesture.dx)) return false
      session = { mode, stage: leftPanels.stage }
      return true
    },
    onPanResponderGrant: () => {
      beginWorkspaceDrag(readContext(), session)
    },
    onPanResponderMove: (_, gesture) => {
      moveWorkspaceDrag(gesture, readContext(), session)
    },
    onPanResponderRelease: (_, gesture) => finishWorkspaceDrag(gesture, readContext(), session),
    onPanResponderTerminate: (_, gesture) => finishWorkspaceDrag(gesture, readContext(), session),
    onPanResponderTerminationRequest: () => false,
  }).panHandlers
}

type WorkspaceDragSession = { mode: TabletWorkspaceDragMode; stage: TabletLeftPanelStage } | null

function beginWorkspaceDrag(context: WorkspacePanContext | null, session: WorkspaceDragSession) {
  if (!session || !context) return
  if (session.mode === 'properties') context.properties.beginDrag()
  else context.leftPanels.beginDrag()
}

function moveWorkspaceDrag(
  gesture: PanResponderGestureState,
  context: WorkspacePanContext | null,
  session: WorkspaceDragSession,
) {
  if (!session || !context) return
  if (session.mode === 'properties') context.properties.drag(gesture.dx)
  else context.leftPanels.drag(gesture.dx, session.stage)
}

function workspaceDragMode(
  gesture: PanResponderGestureState,
  propertiesVisible: boolean,
  screenWidth: number,
) {
  return tabletWorkspaceDragMode({
    dx: gesture.dx,
    propertiesVisible,
    screenWidth,
    x0: gesture.x0,
  })
}

function finishWorkspaceDrag(
  gesture: PanResponderGestureState,
  context: WorkspacePanContext | null,
  session: { mode: TabletWorkspaceDragMode; stage: TabletLeftPanelStage } | null,
) {
  if (!session || !context) return
  const { leftPanels, properties } = context
  if (session.mode === 'properties') properties.finishDrag(gesture.dx, gesture.vx)
  else leftPanels.finishDrag(gesture.dx, gesture.vx, session.stage)
}

function defaultLeftStage(options: TabletPanelGestureOptions): TabletLeftPanelStage {
  if (options.compactTablet || !options.defaultSidebarVisible) return 'list'
  return 'all'
}

export function useTabletPanelGestures(options: TabletPanelGestureOptions) {
  const restoreStage = defaultLeftStage(options)
  const initialStage = options.defaultPropertiesVisible && options.propertiesReplaceSidebar
    ? 'editor'
    : restoreStage
  const leftPanels = useLeftPanelMotion(initialStage, options.compactTablet)
  const properties = usePropertiesPanelMotion({
    compactTablet: options.compactTablet,
    defaultPropertiesVisible: options.defaultPropertiesVisible,
    leftPanels,
    propertiesReplaceSidebar: options.propertiesReplaceSidebar,
    restoreStage,
  })
  const workspacePanHandlers = useWorkspacePanHandlers({ leftPanels, properties })
  const showLeftStage = useCallback((stage: TabletLeftPanelStage) => {
    properties.hide(false)
    leftPanels.settle(stage)
  }, [leftPanels, properties])
  const showSidebar = leftPanels.stage === 'all' && !options.compactTablet
  const noteListVisible = leftPanels.stage !== 'editor'

  return {
    hideLeftChrome: useCallback(() => showLeftStage('editor'), [showLeftStage]),
    hideProperties: properties.hide,
    leftChromeMotionStyle: leftPanels.motionStyle,
    leftChromeVisible: true,
    noteListVisible,
    propertiesMotionStyle: properties.motionStyle,
    propertiesPanelVisible: true,
    propertiesVisible: properties.visible,
    renderNoteList: true,
    renderSidebar: !options.compactTablet,
    showAllPanels: useCallback(() => {
      leftPanels.settle('all')
      if (options.propertiesReplaceSidebar) properties.hide(false)
      else properties.show()
    }, [leftPanels, options.propertiesReplaceSidebar, properties]),
    showEditorList: useCallback(() => showLeftStage('list'), [showLeftStage]),
    showEditorOnly: useCallback(() => showLeftStage('editor'), [showLeftStage]),
    showLeftChrome: useCallback(() => showLeftStage('all'), [showLeftStage]),
    showProperties: properties.show,
    showSidebar,
    toggleProperties: useCallback(() => {
      if (properties.visible) properties.hide()
      else properties.show()
    }, [properties]),
    toggleSidebar: useCallback(() => {
      showLeftStage(showSidebar ? 'list' : 'all')
    }, [showLeftStage, showSidebar]),
    toggleSidebarAndNoteList: useCallback(() => {
      showLeftStage(noteListVisible ? 'editor' : 'all')
    }, [noteListVisible, showLeftStage]),
    workspacePanHandlers,
  }
}
