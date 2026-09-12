import fs from 'node:fs'
import { describe, expect, it } from 'vitest'
import { renderMermaidHtml } from './htmlMermaidPreview'

const plainHtml = fs.readFileSync('tests/fixtures/html-preview/plain.html', 'utf8')
const deckHtml = fs.readFileSync('tests/fixtures/html-preview/mermaid-deck.html', 'utf8')
const fenceHtml = fs.readFileSync('tests/fixtures/html-preview/mermaid-fence.html', 'utf8')

const collectedDiagramsHtml: string[] = []
const collectedIdsHtml: string[] = []
const collectedResultsHtml: string[] = []
let renderCallsHtml = 0

async function renderCountingHtml(diagramHtml: string, idHtml: string): Promise<string> {
  renderCallsHtml += 1
  collectedDiagramsHtml.push(diagramHtml)
  collectedIdsHtml.push(idHtml)
  return `<svg id="${idHtml}" xmlns="http://www.w3.org/2000/svg"><g>rendered</g></svg>`
}

async function renderEmptyHtml(): Promise<string> {
  return `   `
}

function resetRenderSpies(): void {
  renderCallsHtml = 0
  collectedDiagramsHtml.length = 0
  collectedIdsHtml.length = 0
  collectedResultsHtml.length = 0
}

describe('renderMermaidHtml', () => {
  it('returns the source document untouched when no mermaid sources exist', async () => {
    resetRenderSpies()
    const resultHtml = await renderMermaidHtml(plainHtml, renderCountingHtml)
    collectedResultsHtml.push(resultHtml)

    expect(renderCallsHtml).toBe(0)
    expect(collectedResultsHtml[0]).toContain('No diagrams')
  })

  it('replaces pre.mermaid sources with rendered svg containers', async () => {
    resetRenderSpies()
    const resultHtml = await renderMermaidHtml(deckHtml, renderCountingHtml)
    collectedResultsHtml.push(resultHtml)

    expect(renderCallsHtml).toBe(2)
    expect(collectedDiagramsHtml[0]).toContain('flowchart TD')
    expect(collectedResultsHtml[0]).toContain('data-tolaria-mermaid-rendered')
    expect(collectedResultsHtml[0]).not.toContain('flowchart TD')
  })

  it('renders code.language-mermaid fences inside pre elements', async () => {
    resetRenderSpies()
    const resultHtml = await renderMermaidHtml(fenceHtml, renderCountingHtml)
    collectedResultsHtml.push(resultHtml)

    expect(renderCallsHtml).toBe(1)
    expect(collectedDiagramsHtml[0]).toContain('sequenceDiagram')
    expect(collectedResultsHtml[0]).toContain('data-tolaria-mermaid-rendered')
  })

  it('assigns unique render ids across multiple diagrams', async () => {
    resetRenderSpies()
    await renderMermaidHtml(deckHtml, renderCountingHtml)

    expect(collectedIdsHtml).toHaveLength(2)
    expect(collectedIdsHtml[0] !== collectedIdsHtml[1]).toBe(true)
  })

  it('keeps the source text visible when the renderer produces no svg', async () => {
    const resultHtml = await renderMermaidHtml(deckHtml, renderEmptyHtml)

    expect(resultHtml).toContain('flowchart TD')
    expect(resultHtml).toContain('pre class="mermaid"')
    expect(resultHtml).not.toContain('data-tolaria-mermaid-rendered')
  })
})
