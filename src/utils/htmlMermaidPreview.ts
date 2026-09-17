import { renderMermaidDiagram } from './mermaidRender'

const MERMAID_SOURCE_SELECTOR = ['pre.mermaid', 'div.mermaid', 'code.language-mermaid'].join(',')
const RENDER_ID_PREFIX = 'tolaria-html-preview-mermaid'

export type MermaidSourceRenderer = (diagram: string, renderId: string) => Promise<string>

function defaultMermaidSourceRenderer(): MermaidSourceRenderer {
  return (diagram, renderId) => renderMermaidDiagram({ diagram, renderId })
}

function collectMermaidSourceNodes(documentObject: Document): Element[] {
  return Array.from(documentObject.querySelectorAll(MERMAID_SOURCE_SELECTOR))
    .filter(node => (node.textContent ?? '').trim().length > 0)
}

function insertionTargetFor(node: Element): Element {
  const parent = node.parentElement
  if (node.tagName === 'CODE' && parent !== null && parent.tagName === 'PRE') return parent
  return node
}

function buildRenderedContainer(documentObject: Document, svg: string): Element | null {
  const parsed = new DOMParser().parseFromString(svg, 'image/svg+xml')
  if (parsed.getElementsByTagName('parsererror').length > 0) return null

  const svgElement = parsed.documentElement
  if (svgElement.nodeName.toLowerCase() !== 'svg') return null

  const container = documentObject.createElement('div')
  container.setAttribute('data-tolaria-mermaid-rendered', '')
  container.append(documentObject.importNode(svgElement, true))
  return container
}

export async function renderMermaidHtml(
  srcDoc: string,
  render: MermaidSourceRenderer = defaultMermaidSourceRenderer(),
): Promise<string> {
  const documentObject = new DOMParser().parseFromString(srcDoc, 'text/html')
  const nodes = collectMermaidSourceNodes(documentObject)
  if (nodes.length === 0) return srcDoc

  for (const [index, node] of nodes.entries()) {
    let svg: string
    try {
      svg = await render(node.textContent ?? '', `${RENDER_ID_PREFIX}-${index}`)
    } catch {
      continue
    }
    if (svg.trim().length === 0) continue

    const container = buildRenderedContainer(documentObject, svg)
    if (!container) continue
    insertionTargetFor(node).replaceWith(container)
  }
  return `<!doctype html>${documentObject.documentElement.outerHTML}`
}
