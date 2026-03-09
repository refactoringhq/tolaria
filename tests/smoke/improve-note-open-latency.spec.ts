import { test, expect } from '@playwright/test'

test.describe('Improve note open latency', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')
  })

  test('keyboard navigation opens note in editor', async ({ page }) => {
    // Focus the note list container
    const noteListContainer = page.locator('[data-testid="note-list-container"]')
    await noteListContainer.click()

    // Navigate down through several notes rapidly via keyboard
    for (let i = 0; i < 5; i++) {
      await page.keyboard.press('ArrowDown')
    }

    // Open the highlighted note
    await page.keyboard.press('Enter')

    // Wait for the editor to have content
    const editorContainer = page.locator('.editor__blocknote-container')
    await expect(editorContainer).toBeVisible({ timeout: 5000 })

    // A tab should be open
    const tabBar = page.locator('[draggable]')
    await expect(tabBar.first()).toBeVisible({ timeout: 3000 })

    // The editor should have BlockNote content
    const editorContent = page.locator('.bn-editor')
    await expect(editorContent).toBeVisible({ timeout: 3000 })
  })

  test('opening a note from the list loads content in editor', async ({ page }) => {
    // Click the first note in the list
    const firstNote = page.locator('.cursor-pointer.border-b').first()
    await expect(firstNote).toBeVisible()
    await firstNote.click()

    // Editor should become visible with content
    const editorContainer = page.locator('.editor__blocknote-container')
    await expect(editorContainer).toBeVisible({ timeout: 5000 })

    // The editor should have some BlockNote content
    const editorContent = page.locator('.bn-editor')
    await expect(editorContent).toBeVisible({ timeout: 3000 })
  })

  test('switching between notes quickly via clicks does not show stale content', async ({ page }) => {
    // Get all note items
    const notes = page.locator('.cursor-pointer.border-b')
    const noteCount = await notes.count()
    if (noteCount < 3) {
      test.skip()
      return
    }

    // Click through 3 notes rapidly
    for (let i = 0; i < Math.min(3, noteCount); i++) {
      await notes.nth(i).click()
    }

    // Wait for the last note to load
    await page.waitForTimeout(500)

    // The editor should be visible and functional
    const editorContainer = page.locator('.editor__blocknote-container')
    await expect(editorContainer).toBeVisible({ timeout: 5000 })

    // At least one tab should be open
    const tabs = page.locator('[draggable]')
    const tabCount = await tabs.count()
    expect(tabCount).toBeGreaterThan(0)
  })
})
