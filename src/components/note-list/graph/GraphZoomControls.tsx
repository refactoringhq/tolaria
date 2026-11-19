import { ArrowsIn, Minus, Plus } from '@phosphor-icons/react'
import type { ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { type AppLocale, type TranslationKey, translate } from '../../../lib/i18n'

interface GraphZoomControlsProps {
  locale: AppLocale
  onZoomIn: () => void
  onZoomOut: () => void
  onFit: () => void
}

function ZoomButton({ labelKey, locale, testId, onClick, children }: { labelKey: TranslationKey; locale: AppLocale; testId: string; onClick: () => void; children: ReactNode }) {
  const label = translate(locale, labelKey)
  return (
    <Button type="button" variant="ghost" size="icon-xs" className="text-muted-foreground" title={label} aria-label={label} onClick={onClick} data-testid={testId}>
      {children}
    </Button>
  )
}

/** Zoom in, zoom out and fit, in the canvas corner; wheel, trackpad and drag work on the canvas itself. */
export function GraphZoomControls({ locale, onZoomIn, onZoomOut, onFit }: GraphZoomControlsProps) {
  return (
    <div className="graph-zoom-controls" data-testid="graph-zoom-controls">
      <ZoomButton labelKey="graph.zoomIn" locale={locale} testId="graph-zoom-in" onClick={onZoomIn}><Plus size={14} /></ZoomButton>
      <ZoomButton labelKey="graph.zoomOut" locale={locale} testId="graph-zoom-out" onClick={onZoomOut}><Minus size={14} /></ZoomButton>
      <ZoomButton labelKey="graph.fit" locale={locale} testId="graph-zoom-fit" onClick={onFit}><ArrowsIn size={14} /></ZoomButton>
    </div>
  )
}
