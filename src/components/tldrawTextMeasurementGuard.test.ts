import { describe, expect, it, vi } from 'vitest'
import type { Editor } from 'tldraw'
import { installTldrawTextMeasurementGuard } from './tldrawTextMeasurementGuard'

type TextMeasure = Pick<Editor, 'textMeasure'>['textMeasure']
type MeasureElementTextNodeSpans = TextMeasure['measureElementTextNodeSpans']

function textMeasureHost(measureElementTextNodeSpans: MeasureElementTextNodeSpans) {
  return {
    textMeasure: {
      measureElementTextNodeSpans,
    },
  }
}

function elementWithText(text: string): HTMLElement {
  const element = document.createElement('div')
  element.textContent = text
  vi.spyOn(element, 'getBoundingClientRect').mockReturnValue(DOMRect.fromRect({
    height: 24,
    width: 88,
  }))
  return element
}

describe('tldraw text measurement guard', () => {
  it('falls back to a whole-text span when Edge returns no range rect', () => {
    const originalMeasure = vi.fn(() => {
      throw new TypeError("Cannot read properties of undefined (reading 'top')")
    })
    const host = textMeasureHost(originalMeasure)
    const cleanup = installTldrawTextMeasurementGuard(host)

    expect(host.textMeasure.measureElementTextNodeSpans(elementWithText('Label'))).toEqual({
      didTruncate: false,
      spans: [{
        box: { h: 24, w: 88, x: 0, y: 0 },
        text: 'Label',
      }],
    })

    cleanup()
    expect(() => host.textMeasure.measureElementTextNodeSpans(elementWithText('Label'))).toThrow('top')
  })

  it('preserves first-line truncation for fallback measurements', () => {
    const originalMeasure = vi.fn(() => {
      throw new TypeError("Cannot read properties of undefined (reading 'top')")
    })
    const host = textMeasureHost(originalMeasure)
    installTldrawTextMeasurementGuard(host)

    expect(host.textMeasure.measureElementTextNodeSpans(
      elementWithText('Title\nOverflow'),
      { shouldTruncateToFirstLine: true },
    )).toEqual({
      didTruncate: true,
      spans: [{
        box: { h: 24, w: 88, x: 0, y: 0 },
        text: 'Title',
      }],
    })
  })

  it('handles WebKit missing range rect errors that are not native TypeError instances', () => {
    const originalMeasure = vi.fn(() => {
      throw { message: "undefined is not an object (evaluating 'w.top')" }
    })
    const host = textMeasureHost(originalMeasure)
    installTldrawTextMeasurementGuard(host)

    expect(host.textMeasure.measureElementTextNodeSpans(elementWithText('Canvas label'))).toEqual({
      didTruncate: false,
      spans: [{
        box: { h: 24, w: 88, x: 0, y: 0 },
        text: 'Canvas label',
      }],
    })
  })

  it('rethrows unrelated measurement failures', () => {
    const originalMeasure = vi.fn(() => {
      throw new RangeError('bad measurement state')
    })
    const host = textMeasureHost(originalMeasure)
    installTldrawTextMeasurementGuard(host)

    expect(() => host.textMeasure.measureElementTextNodeSpans(elementWithText('Label')))
      .toThrow('bad measurement state')
  })

  it('does not stack guards when installation happens before the mount callback', () => {
    const originalMeasure = vi.fn(() => {
      throw new TypeError("Cannot read properties of undefined (reading 'top')")
    })
    const host = textMeasureHost(originalMeasure)

    installTldrawTextMeasurementGuard(host)
    const cleanupMountGuard = installTldrawTextMeasurementGuard(host)
    cleanupMountGuard()

    expect(() => host.textMeasure.measureElementTextNodeSpans(elementWithText('Label'))).toThrow('top')
  })
})
