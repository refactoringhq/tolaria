type MermaidApi = typeof import('mermaid')['default']

let initialized = false
let renderQueue = Promise.resolve()

const TIMELINE_KEYWORD = 'timeline'
const WORD_CHARACTER_PATTERN = /^[a-z0-9_]/iu
const TIMELINE_PERIOD_DELIMITER_PATTERN = /^(\s*)(.*?)(:\s+.*)$/u
const TIMELINE_NON_PERIOD_LINE_PATTERN = /^\s*(?:$|%%|#|title\b|section\b|accTitle\s*:|accDescr\s*:|accDescr\s*\{|\})/iu

const MERMAID_RENDER_HOST_STYLE = [
  'position:absolute',
  'left:-10000px',
  'top:-10000px',
  'width:960px',
  'min-height:1px',
  'overflow:hidden',
].join(';')

function initializeMermaid(mermaid: MermaidApi) {
  if (initialized) return

  mermaid.initialize({
    startOnLoad: false,
    securityLevel: 'strict',
    htmlLabels: false,
    theme: 'default',
    suppressErrorRendering: true,
    themeVariables: {
      fontFamily: 'ui-sans-serif, system-ui, sans-serif',
    },
  })
  initialized = true
}

function isTimelineDiagram(diagram: string): boolean {
  const firstStatement = diagram
    .split(/\r?\n/u)
    .map(line => line.trim())
    .find(line => line.length > 0 && !line.startsWith('%%'))
  if (firstStatement === undefined) return false
  if (!firstStatement.toLowerCase().startsWith(TIMELINE_KEYWORD)) return false

  const rest = firstStatement.slice(TIMELINE_KEYWORD.length)
  return rest.length === 0
    || !WORD_CHARACTER_PATTERN.test(rest.charAt(0))
    || /^\s/u.test(rest)
}

function encodeTimelinePeriodLabelColons(line: string): string {
  if (TIMELINE_NON_PERIOD_LINE_PATTERN.test(line)) return line

  const match = TIMELINE_PERIOD_DELIMITER_PATTERN.exec(line)
  if (!match) return line
  const [, indent, periodLabel, rest] = match
  if (!periodLabel.trim().includes(':')) return line

  // Mermaid timeline uses ":" as a field separator, so clock labels need entity colons for rendering.
  return `${indent}${periodLabel.replaceAll(':', '&#58;')}${rest}`
}

function normalizeTimelinePeriodLabelsForRender(diagram: string): string {
  if (!isTimelineDiagram(diagram)) return diagram

  return diagram.split('\n').map(encodeTimelinePeriodLabelColons).join('\n')
}

function appendMermaidRenderHost(): HTMLDivElement {
  const host = document.createElement('div')
  host.setAttribute('data-tolaria-mermaid-render-host', '')
  host.style.cssText = MERMAID_RENDER_HOST_STYLE
  document.body.appendChild(host)
  return host
}

function removeMermaidRenderArtifacts(renderId: string, host: HTMLElement): void {
  host.remove()
  document.getElementById(renderId)?.remove()
  document.getElementById(`d${renderId}`)?.remove()
  document.getElementById(`i${renderId}`)?.remove()
}

function hasSvgParseError(document: Document): boolean {
  return document.getElementsByTagName('parsererror').length > 0
}

function centerMermaidNodeLabels(svg: string): string {
  const parsed = new DOMParser().parseFromString(svg, 'image/svg+xml')
  if (hasSvgParseError(parsed)) return svg

  parsed.querySelectorAll('.node .label text, .node text').forEach((label) => {
    label.setAttribute('text-anchor', 'middle')
    label.querySelectorAll('tspan').forEach((row) => {
      row.setAttribute('text-anchor', 'middle')
    })
  })

  return new XMLSerializer().serializeToString(parsed.documentElement)
}

export async function renderMermaidDiagram({
  diagram,
  renderId,
}: {
  diagram: string
  renderId: string
}): Promise<string> {
  const render = async () => {
    const mermaid = (await import('mermaid')).default
    initializeMermaid(mermaid)
    const renderHost = appendMermaidRenderHost()
    try {
      const result = await mermaid.render(renderId, normalizeTimelinePeriodLabelsForRender(diagram), renderHost)
      return centerMermaidNodeLabels(result.svg)
    } finally {
      removeMermaidRenderArtifacts(renderId, renderHost)
    }
  }
  const nextRender = renderQueue.then(render, render)
  renderQueue = nextRender.then(() => undefined, () => undefined)
  return nextRender
}
