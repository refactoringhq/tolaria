import { test, expect } from '@playwright/test'
import { sendShortcut } from './helpers'

/** Known BlockNote/ProseMirror error that fires during editor re-mount after rename. */
const KNOWN_EDITOR_ERRORS = ['isConnected']

function isKnownEditorError(msg: string): boolean {
  return KNOWN_EDITOR_ERRORS.some(k => msg.includes(k))
}

/**
 * Helper: create a new note, select the existing H1 heading text,
 * replace it with a new title, then wait for the 500 ms title-sync debounce.
 */
async function createNoteWithTitle(page: import('@playwright/test').Page, title: string) {
  // 1. Cmd+N → new "Untitled note" (creates heading with "Untitled note")
  await page.locator('body').click()
  await sendShortcut(page, 'n', ['Control'])
  await expect(page.getByText(/Untitled note/).first()).toBeVisible({ timeout: 3000 })

  // 2. Wait for the heading to render in BlockNote
  const heading = page.locator('[data-content-type="heading"] h1')
  await heading.waitFor({ timeout: 3000 })

  // 3. Triple-click the heading to select all its text, then type replacement
  await heading.click({ clickCount: 3 })
  await page.keyboard.type(title, { delay: 20 })

  // 4. Wait for the 500 ms useHeadingTitleSync debounce to fire + React re-render
  await page.waitForTimeout(800)
}

test.describe('Note filename updates on title change + save', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')
    // Wait for startup toast ("Laputa registered as MCP tool") to dismiss
    await page.waitForTimeout(2500)
  })

  test('Cmd+N creates untitled note, typing new title triggers rename via title sync', async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', (err) => { if (!isKnownEditorError(err.message)) errors.push(err.message) })

    await createNoteWithTitle(page, 'Test Note ABC')

    // Title sync now triggers a full rename (save + rename + wikilink update).
    // The toast should show "Renamed" after the debounce fires.
    const toast = page.locator('.fixed.bottom-8')
    await expect(toast).toContainText('Renamed', { timeout: 5000 })

    // Breadcrumb should show the new title
    const breadcrumb = page.locator('span.truncate.font-medium')
    await expect(breadcrumb.first()).toContainText('Test Note ABC', { timeout: 2000 })

    // Cmd+S should NOT trigger another rename (filename already matches)
    await sendShortcut(page, 's', ['Control'])
    await page.waitForTimeout(500)

    // No unexpected JS errors
    expect(errors).toEqual([])
  })

  test('saving a note whose filename already matches does not trigger rename', async ({ page }) => {
    // Click on an existing note in the note list that already has a matching filename.
    // The default sidebar shows "Notes" section with several notes visible.
    const noteItem = page.locator('.truncate.text-foreground.font-medium').filter({ hasText: /Refactoring/ }).first()
    await noteItem.click()
    await page.waitForTimeout(500)

    // Cmd+S — should show "Saved" or "Nothing to save", NOT "Renamed"
    await sendShortcut(page, 's', ['Control'])

    const toast = page.locator('.fixed.bottom-8')
    await expect(toast).toBeVisible({ timeout: 3000 })
    const toastText = await toast.textContent()
    expect(toastText).not.toContain('Renamed')
  })

  test('rapid title changes only rename to final title', async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', (err) => { if (!isKnownEditorError(err.message)) errors.push(err.message) })

    await createNoteWithTitle(page, 'First Title')

    // Select heading text again and replace with final title
    const heading = page.locator('[data-content-type="heading"] h1')
    await heading.click({ clickCount: 3 })
    await page.keyboard.type('Final Title', { delay: 20 })

    // Wait for debounce to fire — title sync triggers rename automatically
    await page.waitForTimeout(800)

    const toast = page.locator('.fixed.bottom-8')
    await expect(toast).toContainText('Renamed', { timeout: 5000 })

    expect(errors).toEqual([])
  })
})
