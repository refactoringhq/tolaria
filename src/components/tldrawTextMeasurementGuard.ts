import type { Editor } from 'tldraw'
import { errorMessage } from '../utils/vaultErrors'

type TextMeasure = Pick<Editor, 'textMeasure'>['textMeasure']
type MeasureElementTextNodeSpans = TextMeasure['measureElementTextNodeSpans']
type TextMeasurement = ReturnType<MeasureElementTextNodeSpans>
type TextMeasurementOptions = Parameters<MeasureElementTextNodeSpans>[1]

interface TextMeasurementHost {
  textMeasure: {
    measureElementTextNodeSpans: MeasureElementTextNodeSpans
  }
}

interface InstalledTextMeasurementGuard {
  cleanup: () => void
  guardedMeasure: MeasureElementTextNodeSpans
}

const installedGuards = new WeakMap<TextMeasurementHost['textMeasure'], InstalledTextMeasurementGuard>()

function isMissingRangeRectError(error: unknown): boolean {
  const message = errorMessage(error, '').toLowerCase()
  return message.includes('top') && (
    message.includes('cannot read')
    || message.includes('not an object')
    || message.includes('undefined')
  )
}

function finiteSize(value: number): number {
  return Number.isFinite(value) && value > 0 ? value : 1
}

function firstRenderedLine(text: string, options: TextMeasurementOptions): {
  didTruncate: boolean
  text: string
} {
  if (!options?.shouldTruncateToFirstLine) return { didTruncate: false, text }

  const lines = text.split(/\r?\n|\r/)
  return {
    didTruncate: lines.length > 1,
    text: lines[0] ?? '',
  }
}

function fallbackTextNodeSpans(element: HTMLElement, options: TextMeasurementOptions): TextMeasurement {
  const measuredText = firstRenderedLine(element.textContent ?? '', options)
  if (!measuredText.text) return { didTruncate: measuredText.didTruncate, spans: [] }

  const rect = element.getBoundingClientRect()
  return {
    didTruncate: measuredText.didTruncate,
    spans: [{
      box: {
        h: finiteSize(rect.height),
        w: finiteSize(rect.width),
        x: 0,
        y: 0,
      },
      text: measuredText.text,
    }],
  }
}

function guardTextMeasurement(
  textMeasure: TextMeasurementHost['textMeasure'],
  originalMeasure: MeasureElementTextNodeSpans,
): MeasureElementTextNodeSpans {
  return (element, options) => {
    try {
      return originalMeasure.call(textMeasure, element, options)
    } catch (error) {
      if (!isMissingRangeRectError(error)) throw error
      return fallbackTextNodeSpans(element, options)
    }
  }
}

function cleanupGuard(
  textMeasure: TextMeasurementHost['textMeasure'],
  guardedMeasure: MeasureElementTextNodeSpans,
  originalMeasure: MeasureElementTextNodeSpans,
) {
  return () => {
    if (installedGuards.get(textMeasure)?.guardedMeasure !== guardedMeasure) return

    installedGuards.delete(textMeasure)
    if (textMeasure.measureElementTextNodeSpans === guardedMeasure) {
      textMeasure.measureElementTextNodeSpans = originalMeasure
    }
  }
}

export function installTldrawTextMeasurementGuard(host: TextMeasurementHost): () => void {
  const { textMeasure } = host
  const installedGuard = installedGuards.get(textMeasure)
  if (installedGuard?.guardedMeasure === textMeasure.measureElementTextNodeSpans) {
    return installedGuard.cleanup
  }

  const originalMeasure = textMeasure.measureElementTextNodeSpans
  const guardedMeasure = guardTextMeasurement(textMeasure, originalMeasure)
  textMeasure.measureElementTextNodeSpans = guardedMeasure
  const cleanup = cleanupGuard(textMeasure, guardedMeasure, originalMeasure)
  installedGuards.set(textMeasure, { cleanup, guardedMeasure })
  return cleanup
}
