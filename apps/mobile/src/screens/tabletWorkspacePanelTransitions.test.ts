import { describe, expect, it } from 'vitest'
import { desktopPanelParity } from '../ui/desktopParity'
import {
  restoreTabletPanelVisibility,
  tabletLeftPanelDragOffset,
  tabletLeftPanelStageAfterDrag,
  tabletLeftPanelStageOffset,
  tabletLeftChromeRendered,
  tabletLeftChromeDragOffset,
  tabletLeftChromeLayout,
  tabletLeftChromeWidth,
  tabletPropertiesVisibleAfterDrag,
  tabletPropertiesDragOffset,
  tabletWorkspaceDragMode,
} from './tabletWorkspacePanelTransitions'

describe('tablet left-panel direct manipulation', () => {
  it('uses desktop widths as sequential all, list, and editor snap points', () => {
    expect(tabletLeftPanelStageOffset('all', false)).toBe(0)
    expect(tabletLeftPanelStageOffset('list', false)).toBe(-desktopPanelParity.sidebarWidth)
    expect(tabletLeftPanelStageOffset('editor', false)).toBe(
      -(desktopPanelParity.sidebarWidth + desktopPanelParity.noteListWidth),
    )
  })

  it('moves through both left panels in one uninterrupted drag', () => {
    expect(tabletLeftPanelDragOffset({ compactTablet: false, dx: -180, stage: 'all' })).toBe(-180)
    expect(tabletLeftPanelDragOffset({ compactTablet: false, dx: -420, stage: 'all' })).toBe(-420)
    expect(tabletLeftPanelDragOffset({ compactTablet: false, dx: -900, stage: 'all' })).toBe(-600)
  })

  it('settles to the nearest sequential state and honors a deliberate flick', () => {
    expect(tabletLeftPanelStageAfterDrag({ compactTablet: false, dx: -180, stage: 'all', vx: 0 })).toBe('list')
    expect(tabletLeftPanelStageAfterDrag({ compactTablet: false, dx: -520, stage: 'all', vx: 0 })).toBe('editor')
    expect(tabletLeftPanelStageAfterDrag({ compactTablet: false, dx: -520, stage: 'all', vx: -1 })).toBe('editor')
    expect(tabletLeftPanelStageAfterDrag({ compactTablet: false, dx: 190, stage: 'editor', vx: 0 })).toBe('list')
    expect(tabletLeftPanelStageAfterDrag({ compactTablet: false, dx: -30, stage: 'all', vx: -0.7 })).toBe('list')
  })

  it('omits the sidebar stage on compact iPads', () => {
    expect(tabletLeftPanelStageOffset('all', true)).toBe(0)
    expect(tabletLeftPanelStageOffset('list', true)).toBe(0)
    expect(tabletLeftPanelStageOffset('editor', true)).toBe(-desktopPanelParity.noteListWidth)
    expect(tabletLeftPanelStageAfterDrag({ compactTablet: true, dx: -200, stage: 'list', vx: 0 })).toBe('editor')
  })

  it('continues an interrupted animation from its presented offset', () => {
    expect(tabletLeftPanelDragOffset({ compactTablet: false, dx: 20, stage: 'editor', startOffset: -180 })).toBe(-160)
    expect(tabletLeftPanelStageAfterDrag({ compactTablet: false, dx: 20, stage: 'editor', startOffset: -180, vx: 0 })).toBe('list')
  })
})

describe('tablet workspace drag ownership', () => {
  it('routes ordinary drags anywhere in the workspace to the left panel sequence', () => {
    expect(tabletWorkspaceDragMode({
      dx: -40,
      propertiesVisible: false,
      screenWidth: 1366,
      x0: 500,
    })).toBe('left')
  })

  it('reserves an inward drag from the right edge for Properties', () => {
    expect(tabletWorkspaceDragMode({
      dx: -40,
      propertiesVisible: false,
      screenWidth: 1366,
      x0: 1350,
    })).toBe('properties')
    expect(tabletPropertiesVisibleAfterDrag({ dx: -170, visible: false, vx: 0 })).toBe(true)
  })

  it('routes a rightward drag to visible Properties so it can be dismissed', () => {
    expect(tabletWorkspaceDragMode({
      dx: 40,
      propertiesVisible: true,
      screenWidth: 1366,
      x0: 1200,
    })).toBe('properties')
    expect(tabletPropertiesVisibleAfterDrag({ dx: 170, visible: true, vx: 0 })).toBe(false)
  })

  it('does not let visible Properties steal drags from the note list or editor', () => {
    expect(tabletWorkspaceDragMode({ dx: 40, propertiesVisible: true, screenWidth: 1366, x0: 400 })).toBe('left')
    expect(tabletWorkspaceDragMode({ dx: 40, propertiesVisible: true, screenWidth: 1366, x0: 900 })).toBe('left')
  })
})

describe('tabletLeftChromeWidth', () => {
  it('moves the sidebar and note list together on regular iPad layouts', () => {
    expect(tabletLeftChromeWidth({
      compactTablet: false,
      noteListVisible: true,
      sidebarVisible: true,
    })).toBe(desktopPanelParity.sidebarWidth + desktopPanelParity.noteListWidth)
  })

  it('keeps compact tablet chrome to the note list rail', () => {
    expect(tabletLeftChromeWidth({
      compactTablet: true,
      noteListVisible: true,
      sidebarVisible: true,
    })).toBe(desktopPanelParity.noteListWidth)
  })

  it('uses the target width while revealing hidden chrome', () => {
    expect(tabletLeftChromeWidth({
      compactTablet: false,
      noteListVisible: false,
      previewVisible: true,
      sidebarVisible: true,
    })).toBe(desktopPanelParity.sidebarWidth + desktopPanelParity.noteListWidth)
  })
})

describe('tabletLeftChromeLayout', () => {
  it('keeps note list rendering independent from persistent sidebar visibility', () => {
    expect(tabletLeftChromeLayout({
      compactTablet: false,
      noteListVisible: true,
      previewVisible: false,
      sidebarVisible: false,
    })).toEqual({
      currentWidth: desktopPanelParity.noteListWidth,
      rendered: true,
      renderNoteList: true,
      renderSidebar: false,
      revealWidth: desktopPanelParity.sidebarWidth + desktopPanelParity.noteListWidth,
      showSidebar: false,
    })
  })

  it('restores exactly the panels that were visible before Properties opened', () => {
    const restored: string[] = []

    restoreTabletPanelVisibility(
      { noteList: true, sidebar: false },
      (panel) => restored.push(panel),
    )

    expect(restored).toEqual(['noteList'])
  })
})

describe('tabletLeftChromeRendered', () => {
  it('removes left chrome while Properties replaces it on narrow iPads', () => {
    expect(tabletLeftChromeRendered({
      propertiesPanelVisible: true,
      propertiesReplaceSidebar: true,
    })).toBe(false)
  })

  it('keeps left chrome when the viewport can show Properties beside it', () => {
    expect(tabletLeftChromeRendered({
      propertiesPanelVisible: true,
      propertiesReplaceSidebar: false,
    })).toBe(true)
  })

  it('keeps the reveal rail mounted when left chrome is hidden', () => {
    expect(tabletLeftChromeRendered({
      propertiesPanelVisible: false,
      propertiesReplaceSidebar: false,
    })).toBe(true)
  })
})

describe('tabletLeftChromeDragOffset', () => {
  it('clamps visible left chrome while hiding it', () => {
    expect(tabletLeftChromeDragOffset({ dx: -900, visible: true, width: 600 })).toBe(-600)
    expect(tabletLeftChromeDragOffset({ dx: -120, visible: true, width: 600 })).toBe(-120)
    expect(tabletLeftChromeDragOffset({ dx: 80, visible: true, width: 600 })).toBe(0)
  })

  it('reveals hidden left chrome from its offscreen edge', () => {
    expect(tabletLeftChromeDragOffset({ dx: 0, visible: false, width: 600 })).toBe(-600)
    expect(tabletLeftChromeDragOffset({ dx: 180, visible: false, width: 600 })).toBe(-420)
    expect(tabletLeftChromeDragOffset({ dx: 900, visible: false, width: 600 })).toBe(0)
  })
})

describe('tabletPropertiesDragOffset', () => {
  it('clamps visible properties while hiding it to the right', () => {
    expect(tabletPropertiesDragOffset({ dx: 900, visible: true })).toBe(desktopPanelParity.inspectorWidth)
    expect(tabletPropertiesDragOffset({ dx: 120, visible: true })).toBe(120)
    expect(tabletPropertiesDragOffset({ dx: -80, visible: true })).toBe(0)
  })

  it('reveals hidden properties from the right edge', () => {
    expect(tabletPropertiesDragOffset({ dx: 0, visible: false })).toBe(desktopPanelParity.inspectorWidth)
    expect(tabletPropertiesDragOffset({ dx: -120, visible: false })).toBe(desktopPanelParity.inspectorWidth - 120)
    expect(tabletPropertiesDragOffset({ dx: -900, visible: false })).toBe(0)
  })
})
