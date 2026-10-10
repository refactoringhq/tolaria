import { describe, expect, it } from 'vitest'
import { tabletPanelPositionAfterResize } from './tabletPanelResize'

describe('tabletPanelPositionAfterResize', () => {
  it('hides the sidebar first when rotating a wide tablet to portrait', () => {
    expect(tabletPanelPositionAfterResize({ stage: 'all', propertiesVisible: false }, 1032, false))
      .toEqual({ stage: 'list', propertiesVisible: false })
  })

  it('keeps the inspector and gives the editor room by hiding the note list', () => {
    expect(tabletPanelPositionAfterResize({ stage: 'list', propertiesVisible: true }, 1032, false))
      .toEqual({ stage: 'editor', propertiesVisible: true })
  })

  it('does not reopen panels the user hid when the window grows', () => {
    const position = { stage: 'editor' as const, propertiesVisible: false }
    expect(tabletPanelPositionAfterResize(position, 1600, false)).toBe(position)
  })

  it('respects compact sidebar geometry and the exact readable boundary', () => {
    expect(tabletPanelPositionAfterResize({ stage: 'all', propertiesVisible: false }, 860, true))
      .toEqual({ stage: 'list', propertiesVisible: false })
    expect(tabletPanelPositionAfterResize({ stage: 'list', propertiesVisible: false }, 859, true))
      .toEqual({ stage: 'editor', propertiesVisible: false })
  })

  it('does not leave an inspector squeezing a window narrower than both panes', () => {
    expect(tabletPanelPositionAfterResize({ stage: 'all', propertiesVisible: true }, 700, false))
      .toEqual({ stage: 'editor', propertiesVisible: false })
  })
})
