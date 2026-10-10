import { useCallback, useLayoutEffect, useMemo, useState } from 'react'
import { useWindowDimensions } from 'react-native'
import { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated'
import { desktopPanelParity } from '../ui/desktopParity'
import { tabletLeftPanelStageAfterDrag, tabletLeftPanelStageOffset, type TabletLeftPanelStage } from './tabletWorkspacePanelTransitions'
import { createTabletPanGesture, tabletPanelSpring, type TabletPanelPosition, type TabletPanSession } from './tabletNativePanGesture'

export type TabletPanelGestureOptions = {
  compactTablet: boolean
  defaultPropertiesVisible: boolean
  defaultSidebarVisible: boolean
  exclusiveSidePanels: boolean
  propertiesReplaceSidebar: boolean
}

function initialLeftStage(options: TabletPanelGestureOptions): TabletLeftPanelStage {
  if (options.defaultPropertiesVisible && options.propertiesReplaceSidebar) return 'editor'
  return options.compactTablet || !options.defaultSidebarVisible ? 'list' : 'all'
}

export function useTabletPanelGestures(options: TabletPanelGestureOptions) {
  const { width } = useWindowDimensions()
  const { compactTablet, propertiesReplaceSidebar } = options
  const [position, setPosition] = useState<TabletPanelPosition>(() => ({
    stage: initialLeftStage(options),
    propertiesVisible: options.defaultPropertiesVisible,
  }))
  const left = useSharedValue(tabletLeftPanelStageOffset(initialLeftStage(options), compactTablet))
  const properties = useSharedValue(options.defaultPropertiesVisible ? 0 : desktopPanelParity.inspectorWidth)
  const restoreLeft = useSharedValue(tabletLeftPanelStageOffset(options.defaultSidebarVisible ? 'all' : 'list', compactTablet))
  const session = useSharedValue<TabletPanSession>({ x: 0, y: 0, left: 0, properties: 0, mode: 'wait' })
  const motion = useMemo(() => ({ left, properties, restoreLeft }), [left, properties, restoreLeft])
  const panGesture = useMemo(() => createTabletPanGesture({
    compactTablet, propertiesReplaceSidebar, width, motion, session, onSettle: setPosition,
  }), [compactTablet, propertiesReplaceSidebar, width, motion, session])

  const settle = useCallback((stage: TabletLeftPanelStage, propertiesVisible: boolean) => {
    const normalized = compactTablet && stage === 'all' ? 'list' : stage
    left.set(withSpring(tabletLeftPanelStageOffset(normalized, compactTablet), tabletPanelSpring))
    properties.set(withSpring(propertiesVisible ? 0 : desktopPanelParity.inspectorWidth, tabletPanelSpring))
    setPosition({ stage: normalized, propertiesVisible })
  }, [compactTablet, left, properties])

  useLayoutEffect(() => {
    left.set(withSpring(tabletLeftPanelStageOffset(position.stage, compactTablet), tabletPanelSpring))
  }, [compactTablet, left, position.stage])

  const showLeftStage = useCallback((stage: TabletLeftPanelStage) => settle(stage, false), [settle])
  const showProperties = useCallback(() => {
    if (!position.propertiesVisible) restoreLeft.set(left.value)
    settle(propertiesReplaceSidebar ? 'editor' : position.stage, true)
  }, [left, position, propertiesReplaceSidebar, restoreLeft, settle])
  const hideProperties = useCallback(() => {
    const stage = propertiesReplaceSidebar
      ? tabletLeftPanelStageAfterDrag({ compactTablet, stage: 'all', startOffset: restoreLeft.value, dx: 0, vx: 0 })
      : position.stage
    settle(stage, false)
  }, [compactTablet, position.stage, propertiesReplaceSidebar, restoreLeft, settle])
  const showSidebar = position.stage === 'all' && !compactTablet
  const noteListVisible = position.stage !== 'editor'
  const leftChromeMotionStyle = useAnimatedStyle(() => ({
    marginRight: left.value,
    transform: [{ translateX: left.value }],
  }))
  const propertiesMotionStyle = useAnimatedStyle(() => ({
    marginLeft: -properties.value,
    transform: [{ translateX: properties.value }],
  }))

  return {
    hideLeftChrome: useCallback(() => showLeftStage('editor'), [showLeftStage]),
    hideProperties,
    leftChromeMotionStyle,
    leftChromeVisible: true,
    noteListVisible,
    panGesture,
    propertiesMotionStyle,
    propertiesPanelVisible: true,
    propertiesVisible: position.propertiesVisible,
    renderNoteList: true,
    renderSidebar: !compactTablet,
    showAllPanels: useCallback(() => settle('all', !propertiesReplaceSidebar), [propertiesReplaceSidebar, settle]),
    showEditorList: useCallback(() => showLeftStage('list'), [showLeftStage]),
    showEditorOnly: useCallback(() => showLeftStage('editor'), [showLeftStage]),
    showLeftChrome: useCallback(() => showLeftStage('all'), [showLeftStage]),
    showProperties,
    showSidebar,
    toggleProperties: useCallback(() => {
      if (position.propertiesVisible) hideProperties()
      else showProperties()
    }, [hideProperties, position.propertiesVisible, showProperties]),
    toggleSidebar: useCallback(() => showLeftStage(showSidebar ? 'list' : 'all'), [showLeftStage, showSidebar]),
    toggleSidebarAndNoteList: useCallback(() => showLeftStage(noteListVisible ? 'editor' : 'all'), [noteListVisible, showLeftStage]),
  }
}
