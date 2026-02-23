import { test, expect } from '@playwright/test'

test.use({ baseURL: 'http://localhost:5239' })

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await page.waitForTimeout(2000) // Wait for vault data to load
})

test('editor loads and renders note content for editing', async ({ page }) => {
  await page.screenshot({ path: 'test-results/save-01-initial.png', fullPage: true })

  // 1. Click a note in the note list panel
  const noteList = page.locator('.app__note-list')
  await expect(noteList).toBeVisible({ timeout: 5000 })
  const firstNote = noteList.locator('div.cursor-pointer').first()
  await expect(firstNote).toBeVisible({ timeout: 5000 })
  await firstNote.click()
  await page.waitForTimeout(1000)

  // 2. Verify the BlockNote editor is visible with content
  const editor = page.locator('.bn-editor')
  await expect(editor).toBeVisible({ timeout: 5000 })

  // Verify the editor is contenteditable (ready for editing)
  const isEditable = await editor.getAttribute('contenteditable')
  expect(isEditable).toBe('true')

  await page.screenshot({ path: 'test-results/save-02-note-open.png', fullPage: true })

  // 3. Verify the editor has content (not empty)
  const editorText = await page.evaluate(() => {
    const el = document.querySelector('.bn-editor')
    return el?.textContent ?? ''
  })
  expect(editorText.length).toBeGreaterThan(10)

  // 4. Verify tab bar shows the active note
  const tabBar = page.locator('.editor')
  await expect(tabBar).toBeVisible()

  await page.screenshot({ path: 'test-results/save-03-editor-ready.png', fullPage: true })
})

test('Cmd+S triggers explicit save and shows toast', async ({ page }) => {
  // Open a note
  const noteList = page.locator('.app__note-list')
  await expect(noteList).toBeVisible({ timeout: 5000 })
  const firstNote = noteList.locator('div.cursor-pointer').first()
  await firstNote.click()
  await page.waitForTimeout(1000)

  // Type some content to make the editor dirty
  const editor = page.locator('.bn-editor')
  await editor.click()
  await page.keyboard.type('Hello from Cmd+S test')
  await page.waitForTimeout(300)

  // Press Cmd+S
  await page.keyboard.press('Meta+s')
  await page.waitForTimeout(500)

  // Verify toast appears with "Saved" message
  const toast = page.locator('text=Saved')
  await expect(toast).toBeVisible({ timeout: 3000 })

  await page.screenshot({ path: 'test-results/save-04-cmd-s-saved.png', fullPage: true })
})
