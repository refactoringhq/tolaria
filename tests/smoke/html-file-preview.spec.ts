import fs from 'fs'
import { expect, test, type Page } from '@playwright/test'
import { APP_COMMAND_IDS } from '../../src/hooks/appCommandCatalog'
import {
  createFixtureVaultCopy,
  openFixtureVaultDesktopHarness,
  removeFixtureVaultCopy,
} from '../helpers/fixtureVault'
import { triggerShortcutCommand } from './testBridge'

const HTML_FILENAME = 'viewer-test.html'
const HTML_CONTENT = `<!doctype html>
<html>
  <head><style>body { background: rgb(15 23 42); color: white; }</style></head>
  <body>
    <h1>HTML preview is rendering</h1>
    <button id="verify">Try JavaScript</button>
    <p id="result">Scripts stayed blocked</p>
    <script>document.querySelector('#result').textContent = 'Script executed'</script>
  </body>
</html>`

const DECK_FILENAME = 'deck-static-test.html'
const DECK_CONTENT = `<!doctype html>
<html>
  <head><style>
    html,body{height:100%;overflow:hidden}
    .slide{position:absolute;inset:0;opacity:0;visibility:hidden;transform:translateY(16px);pointer-events:none}
    .slide.active{opacity:1;visibility:visible;transform:none;pointer-events:auto}
  </style></head>
  <body>
    <section class="slide active"><h2>Slide one visible</h2></section>
    <section class="slide"><h2>Slide two revealed</h2></section>
    <div class="mermaid-box"><pre class="mermaid">flowchart TD
    A[Start] --> B[End]</pre></div>
    <script>document.body.dataset.jsRan = 'yes'</script>
  </body>
</html>`

let tempVaultDir: string

async function setupVaultWithHtmlFiles(page: Page, files: Array<{ filename: string; content: string }>): Promise<void> {
  tempVaultDir = createFixtureVaultCopy()
  for (const file of files) {
    // file.filename is a compile-time constant in this spec, never user input.
    const filePath = `${tempVaultDir}/${file.filename}`
    fs.writeFileSync(filePath, file.content)
    await includeHtmlEntry(page, filePath, file.filename, file.content)
  }
  await openFixtureVaultDesktopHarness(page, tempVaultDir)
}

function buildHtmlEntry(filePath: string, filename: string = HTML_FILENAME, content: string = HTML_CONTENT) {
  return {
    path: filePath,
    filename,
    title: filename,
    isA: null,
    aliases: [],
    belongsTo: [],
    relatedTo: [],
    status: null,
    archived: false,
    modifiedAt: Date.now(),
    createdAt: null,
    fileSize: Buffer.byteLength(content),
    snippet: '',
    wordCount: 0,
    relationships: {},
    icon: null,
    color: null,
    order: null,
    sidebarLabel: null,
    template: null,
    sort: null,
    view: null,
    visible: null,
    organized: false,
    favorite: false,
    favoriteIndex: null,
    listPropertiesDisplay: [],
    outgoingLinks: [],
    properties: {},
    hasH1: false,
    fileKind: 'text',
  }
}

async function includeHtmlEntry(page: Page, filePath: string, filename: string = HTML_FILENAME, content: string = HTML_CONTENT): Promise<void> {
  const htmlEntry = buildHtmlEntry(filePath, filename, content)
  await page.route('**/api/vault/list*', async (route) => {
    const response = await route.fetch()
    const entries = await response.json()
    await route.fulfill({
      response,
      json: Array.isArray(entries) ? [...entries, htmlEntry] : entries,
    })
  })
}

test.afterEach(() => {
  removeFixtureVaultCopy(tempVaultDir)
})

test('previews standalone HTML and exposes source through the breadcrumb and keyboard', async ({ page }) => {
  await setupVaultWithHtmlFiles(page, [{ filename: HTML_FILENAME, content: HTML_CONTENT }])
  await triggerShortcutCommand(page, APP_COMMAND_IDS.fileQuickOpen)
  const quickOpenInput = page.locator('input[placeholder="Search notes..."]')
  await expect(quickOpenInput).toBeVisible({ timeout: 5_000 })
  await quickOpenInput.fill(HTML_FILENAME)
  await page.keyboard.press('Enter')

  const preview = page.getByTestId('html-file-preview')
  await expect(preview).toBeVisible({ timeout: 5_000 })
  const previewFrame = page.frameLocator('[data-testid="html-file-preview"]')
  await expect(previewFrame.getByRole('heading', { name: 'HTML preview is rendering' })).toBeVisible()
  await expect(previewFrame.getByText('Scripts stayed blocked')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Add to favorites' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Set note as organized' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: "Open note's neighborhood" })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Switch to wide note width' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Open table of contents' })).toHaveCount(0)

  await page.evaluate(() => {
    if (!window.__mockHandlers) return
    window.__mockHandlers.can_export_current_webview_pdf = () => false
    window.__mockHandlers.print_current_webview = () => {
      document.body.dataset.pdfExportRequested = 'true'
      return null
    }
  })
  await page.getByRole('button', { name: 'More note actions' }).click()
  const actionMenu = page.getByRole('menu')
  await expect(actionMenu.getByRole('menuitem', { name: 'Archive this note' })).toHaveCount(0)
  await actionMenu.getByRole('menuitem', { name: 'Export note as PDF' }).click()
  await expect(page.locator('body')).toHaveAttribute('data-pdf-export-requested', 'true')
  await page.evaluate(() => window.dispatchEvent(new Event('afterprint')))

  await page.getByRole('button', { name: 'Open the raw editor' }).click()
  const rawEditor = page.getByTestId('raw-editor-codemirror')
  await expect(rawEditor).toBeVisible({ timeout: 5_000 })
  await expect(rawEditor.locator('.cm-line span')).not.toHaveCount(0)

  await page.getByRole('button', { name: 'Return to the editor' }).click()
  await expect(preview).toBeVisible({ timeout: 5_000 })

  await page.keyboard.press(process.platform === 'darwin' ? 'Meta+Backslash' : 'Control+Backslash')
  await expect(page.getByTestId('raw-editor-codemirror')).toBeVisible({ timeout: 5_000 })
})

test('reveals script-gated slides and renders mermaid diagrams without executing scripts', async ({ page }) => {
  await setupVaultWithHtmlFiles(page, [
    { filename: HTML_FILENAME, content: HTML_CONTENT },
    { filename: DECK_FILENAME, content: DECK_CONTENT },
  ])
  await triggerShortcutCommand(page, APP_COMMAND_IDS.fileQuickOpen)
  const quickOpenInput = page.locator('input[placeholder="Search notes..."]')
  await expect(quickOpenInput).toBeVisible({ timeout: 5_000 })
  await quickOpenInput.fill(DECK_FILENAME)
  await page.keyboard.press('Enter')

  const previewFrame = page.frameLocator('[data-testid="html-file-preview"]')
  await expect(previewFrame.getByRole('heading', { name: 'Slide one visible' })).toBeVisible({ timeout: 10_000 })

  await expect(previewFrame.locator('style[data-tolaria-static-preview]')).toHaveCount(1)
  await expect(previewFrame.getByRole('heading', { name: 'Slide two revealed' })).toBeVisible()
  await expect(previewFrame.locator('div[data-tolaria-mermaid-rendered] svg')).toHaveCount(1)
  await expect(previewFrame.locator('script')).toHaveCount(0)
  await expect(previewFrame.locator('body')).not.toHaveAttribute('data-js-ran', 'yes')
})
