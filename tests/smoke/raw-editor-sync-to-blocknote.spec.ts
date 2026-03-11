import { test, expect, type Page } from '@playwright/test'
import { openCommandPalette, executeCommand } from './helpers'

/**
 * Smoke test: editing in raw (CodeMirror) mode and switching back to
 * BlockNote must show the updated content — the two editors stay in sync.
 */

async function openFirstNote(page: Page) {
  const noteList = page.locator('[data-testid="note-list-container"]')
  await noteList.waitFor({ timeout: 5000 })
  await noteList.locator('.cursor-pointer').first().click()
  await page.waitForTimeout(500)
  await expect(page.locator('.bn-editor')).toBeVisible({ timeout: 5000 })
}

async function toggleRawMode(page: Page) {
  await openCommandPalette(page)
  await executeCommand(page, 'Toggle Raw')
  await page.waitForTimeout(500)
}

/** Get the full text content from the CodeMirror raw editor. */
async function getRawEditorContent(page: Page): Promise<string> {
  return page.evaluate(() => {
    const el = document.querySelector('.cm-content')
    if (!el) return ''
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const view = (el as any).cmTile?.view
    if (view) return view.state.doc.toString() as string
    return el.textContent ?? ''
  })
}

/** Replace the entire raw editor content via CodeMirror dispatch (reliable). */
async function setRawEditorContent(page: Page, content: string) {
  await page.evaluate((newContent) => {
    const el = document.querySelector('.cm-content')
    if (!el) return
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const view = (el as any).cmTile?.view
    if (!view) return
    view.dispatch({
      changes: { from: 0, to: view.state.doc.length, insert: newContent },
    })
  }, content)
}

test.describe('Raw editor ↔ BlockNote sync', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1600, height: 900 })
    await page.goto('/')
    await page.waitForLoadState('networkidle')
  })

  test('editing in raw mode and switching to BlockNote shows updated content', async ({ page }) => {
    await openFirstNote(page)

    // Read the original H1 from the BlockNote editor
    const h1Locator = page.locator('.bn-editor h1.bn-inline-content').first()
    await expect(h1Locator).toBeVisible({ timeout: 5000 })
    const originalH1 = await h1Locator.textContent()
    expect(originalH1).toBeTruthy()

    // Toggle to raw mode
    await toggleRawMode(page)
    await expect(page.locator('.cm-content')).toBeVisible()

    // Read raw content and verify it contains the original title
    const rawContent = await getRawEditorContent(page)
    expect(rawContent).toContain(originalH1!)

    // Replace the H1 line with a new heading via CodeMirror dispatch
    const newTitle = 'Updated By Raw Editor'
    const updatedContent = rawContent.replace(
      new RegExp(`# ${originalH1!.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`),
      `# ${newTitle}`,
    )
    await setRawEditorContent(page, updatedContent)
    await page.waitForTimeout(600) // Wait for debounce (500ms)

    // Toggle back to BlockNote
    await toggleRawMode(page)
    await expect(page.locator('.bn-editor')).toBeVisible({ timeout: 5000 })
    await page.waitForTimeout(500)

    // Verify the BlockNote editor shows the updated heading
    const updatedH1 = page.locator('.bn-editor h1.bn-inline-content').first()
    await expect(updatedH1).toContainText(newTitle, { timeout: 5000 })
  })

  test('switching BlockNote → raw → BlockNote multiple times preserves content', async ({ page }) => {
    await openFirstNote(page)

    // Cycle 1: toggle to raw, edit, toggle back
    await toggleRawMode(page)
    await expect(page.locator('.cm-content')).toBeVisible()

    const rawContent1 = await getRawEditorContent(page)
    const edit1 = rawContent1.replace(/# .+/, '# Cycle One Title')
    await setRawEditorContent(page, edit1)
    await page.waitForTimeout(600)

    await toggleRawMode(page)
    await expect(page.locator('.bn-editor')).toBeVisible({ timeout: 5000 })
    await page.waitForTimeout(500)

    await expect(
      page.locator('.bn-editor h1.bn-inline-content').first(),
    ).toContainText('Cycle One Title', { timeout: 5000 })

    // Cycle 2: toggle to raw again, verify content persisted, edit again
    await toggleRawMode(page)
    await expect(page.locator('.cm-content')).toBeVisible()

    const rawContent2 = await getRawEditorContent(page)
    expect(rawContent2).toContain('Cycle One Title')

    const edit2 = rawContent2.replace(/# .+/, '# Cycle Two Title')
    await setRawEditorContent(page, edit2)
    await page.waitForTimeout(600)

    await toggleRawMode(page)
    await expect(page.locator('.bn-editor')).toBeVisible({ timeout: 5000 })
    await page.waitForTimeout(500)

    await expect(
      page.locator('.bn-editor h1.bn-inline-content').first(),
    ).toContainText('Cycle Two Title', { timeout: 5000 })
  })

  test('appended text in raw mode appears in BlockNote after switch', async ({ page }) => {
    await openFirstNote(page)

    // Toggle to raw and append text via CodeMirror dispatch
    await toggleRawMode(page)
    await expect(page.locator('.cm-content')).toBeVisible()

    const content = await getRawEditorContent(page)
    await setRawEditorContent(page, content + '\n\nAppended by raw editor test')
    await page.waitForTimeout(600) // Wait for debounce

    // Toggle back to BlockNote
    await toggleRawMode(page)
    await expect(page.locator('.bn-editor')).toBeVisible({ timeout: 5000 })
    await page.waitForTimeout(500)

    // Verify the appended text shows up in BlockNote
    await expect(page.locator('.bn-editor')).toContainText('Appended by raw editor test', { timeout: 5000 })
  })
})
