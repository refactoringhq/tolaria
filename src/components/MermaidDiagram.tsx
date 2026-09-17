import { ArrowsOut as Maximize2, PencilSimpleLine } from '@phosphor-icons/react'
import { useEffect, useId, useState, type SyntheticEvent } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { APP_COMMAND_EVENT_NAME, APP_COMMAND_IDS } from '../hooks/appCommandDispatcher'
import { translate } from '../lib/i18n'
import { trackEvent } from '../lib/telemetry'
import { renderMermaidDiagram } from '../utils/mermaidRender'
import { SafeSvgDiv } from './SafeMarkup'

interface MermaidDiagramProps {
  diagram: string
  source: string
}

interface MermaidSvgViewportProps {
  ariaLabel: string
  className: string
  svg: string
  testId: string
}

interface RenderState {
  diagram: string
  svg: string
  error: boolean
}

const OPEN_RAW_EDITOR_LABEL = translate('en', 'editor.toolbar.rawOpen')

function renderIdFromReactId(reactId: string): string {
  const safeId = reactId.replace(/[^a-zA-Z0-9_-]/g, '')
  return `tolaria-mermaid-${safeId || 'diagram'}`
}

function MermaidSvgViewport({ ariaLabel, className, svg, testId }: MermaidSvgViewportProps) {
  return (
    <SafeSvgDiv
      aria-label={ariaLabel}
      className={className}
      contentEditable={false}
      data-testid={testId}
      draggable={false}
      onClick={stopMermaidViewportEvent}
      onDoubleClick={stopMermaidViewportEvent}
      onMouseDown={stopMermaidViewportEvent}
      onMouseUp={stopMermaidViewportEvent}
      onPointerDown={stopMermaidViewportEvent}
      onPointerUp={stopMermaidViewportEvent}
      role="img"
      svg={svg}
      suppressContentEditableWarning
      tabIndex={0}
    />
  )
}

function stopMermaidViewportEvent(event: SyntheticEvent): void {
  event.stopPropagation()
}

function openRawEditorForMermaidSource(event: SyntheticEvent): void {
  event.preventDefault()
  event.stopPropagation()
  trackEvent('editor_mermaid_raw_edit_requested')
  window.dispatchEvent(new CustomEvent(APP_COMMAND_EVENT_NAME, {
    detail: APP_COMMAND_IDS.editToggleRawEditor,
  }))
}

function MermaidRawEditorButton() {
  return (
    <Button
      aria-label={OPEN_RAW_EDITOR_LABEL}
      className="mermaid-diagram__edit-button"
      contentEditable={false}
      onClick={openRawEditorForMermaidSource}
      onMouseDown={stopMermaidViewportEvent}
      size="icon-sm"
      title={OPEN_RAW_EDITOR_LABEL}
      type="button"
      variant="outline"
    >
      <PencilSimpleLine aria-hidden="true" />
    </Button>
  )
}

function MermaidLightbox({ svg }: { svg: string }) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button
          aria-label="Open Mermaid diagram"
          className="mermaid-diagram__expand-button"
          size="icon-sm"
          title="Open diagram"
          type="button"
          variant="outline"
        >
          <Maximize2 aria-hidden="true" />
        </Button>
      </DialogTrigger>
      <DialogContent className="mermaid-diagram__dialog" showCloseButton>
        <DialogTitle className="sr-only">Mermaid diagram</DialogTitle>
        <DialogDescription className="sr-only">
          Expanded view of the rendered Mermaid diagram.
        </DialogDescription>
        <MermaidSvgViewport
          ariaLabel="Expanded Mermaid diagram"
          className="mermaid-diagram__dialog-viewport"
          svg={svg}
          testId="mermaid-diagram-dialog-viewport"
        />
      </DialogContent>
    </Dialog>
  )
}

function MermaidSourceFallback({ source }: { source: string }) {
  return <pre role="img" aria-label="Mermaid source"><code>{source}</code></pre>
}

export function MermaidDiagram({ diagram, source }: MermaidDiagramProps) {
  const reactId = useId()
  const renderId = renderIdFromReactId(reactId)
  const [state, setState] = useState<RenderState>({ diagram: '', svg: '', error: false })

  useEffect(() => {
    let active = true
    if (!diagram.trim()) return () => { active = false }

    renderMermaidDiagram({ diagram, renderId })
      .then((svg) => {
        if (active) setState({ diagram, svg, error: false })
      })
      .catch(() => {
        if (active) setState({ diagram, svg: '', error: true })
      })

    return () => { active = false }
  }, [diagram, renderId])

  const currentState = state.diagram === diagram ? state : { diagram, svg: '', error: false }
  if (!diagram.trim() || currentState.error) {
    return (
      <figure className="mermaid-diagram mermaid-diagram--error" data-testid="mermaid-diagram-error">
        <MermaidRawEditorButton />
        <figcaption>Mermaid diagram unavailable</figcaption>
        <MermaidSourceFallback source={source} />
      </figure>
    )
  }

  return (
    <figure className="mermaid-diagram" data-testid="mermaid-diagram">
      <MermaidRawEditorButton />
      <MermaidLightbox svg={currentState.svg} />
      <MermaidSvgViewport
        ariaLabel="Mermaid diagram"
        className="mermaid-diagram__viewport"
        svg={currentState.svg}
        testId="mermaid-diagram-viewport"
      />
    </figure>
  )
}
