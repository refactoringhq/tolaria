import { test, expect, type Page } from '@playwright/test'
import { openCommandPalette, executeCommand } from './helpers'

async function openFirstNoteInRawMode(page: Page) {
  const noteList = page.locator('[data-testid="note-list-container"]')
  await noteList.waitFor({ timeout: 5000 })
  await noteList.locator('.cursor-pointer').first().click()
  await page.waitForTimeout(300)

  await openCommandPalette(page)
  await executeCommand(page, 'Toggle Raw Editor')
  await page.waitForTimeout(300)

  await expect(page.locator('.cm-content')).toBeVisible()
}

async function applyZoom(page: Page, percent: number) {
  await page.evaluate((pct) => {
    document.documentElement.style.setProperty('zoom', `${pct}%`)
    window.dispatchEvent(new Event('laputa-zoom-change'))
  }, percent)
  await page.waitForTimeout(200)
}

async function getCursorPos(page: Page): Promise<number | null> {
  return page.evaluate(() => {
    // Access the EditorView via CodeMirror's internal DOM reference:
    // .cm-content has a .cmTile property whose root.view is the EditorView
    const content = document.querySelector('.cm-content')
    if (!content) return null
    const tile = (content as any).cmTile // eslint-disable-line
    const view = tile?.root?.view
    if (!view) return null
    return view.state.selection.main.head as number
  })
}

async function getSelectionLength(page: Page): Promise<number> {
  return page.evaluate(() => {
    const content = document.querySelector('.cm-content')
    if (!content) return 0
    const tile = (content as any).cmTile // eslint-disable-line
    const view = tile?.root?.view
    if (!view) return 0
    const sel = view.state.selection.main
    return (sel.to - sel.from) as number
  })
}

test.describe('CodeMirror cursor at non-100% zoom', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1600, height: 900 })
    await page.goto('/')
    await page.waitForLoadState('networkidle')
  })

  test('clicking editor at 150% zoom positions cursor near the click point', async ({ page }) => {
    await openFirstNoteInRawMode(page)
    await applyZoom(page, 150)

    const firstLine = page.locator('.cm-line').first()
    const lineBox = await firstLine.boundingBox()
    expect(lineBox).not.toBeNull()

    // Click near the start of the first line (a few pixels in from the left)
    await page.mouse.click(lineBox!.x + 20, lineBox!.y + lineBox!.height / 2)

    const cursorPos = await getCursorPos(page)
    // Cursor should be near the beginning — within first ~30 chars.
    // Without the zoom fix the offset would be much larger.
    expect(cursorPos).not.toBeNull()
    expect(cursorPos!).toBeLessThan(30)
  })

  test('clicking editor at 80% zoom positions cursor near the click point', async ({ page }) => {
    await openFirstNoteInRawMode(page)
    await applyZoom(page, 80)

    const firstLine = page.locator('.cm-line').first()
    const lineBox = await firstLine.boundingBox()
    expect(lineBox).not.toBeNull()

    await page.mouse.click(lineBox!.x + 20, lineBox!.y + lineBox!.height / 2)

    const cursorPos = await getCursorPos(page)
    expect(cursorPos).not.toBeNull()
    expect(cursorPos!).toBeLessThan(30)
  })

  test('double-click selects a word at non-100% zoom', async ({ page }) => {
    await openFirstNoteInRawMode(page)
    await applyZoom(page, 125)

    const firstLine = page.locator('.cm-line').first()
    const lineBox = await firstLine.boundingBox()
    expect(lineBox).not.toBeNull()

    // Double-click near the start of the first line to select a word
    await page.mouse.dblclick(lineBox!.x + 20, lineBox!.y + lineBox!.height / 2)

    const selLen = await getSelectionLength(page)
    // A word was selected (at least 1 character)
    expect(selLen).toBeGreaterThan(0)
  })
})
