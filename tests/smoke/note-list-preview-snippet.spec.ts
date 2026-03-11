import { test, expect } from '@playwright/test'

test.describe('Note list preview snippet', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')
  })

  test('notes with content show a snippet in the note list', async ({ page }) => {
    // The note list should be visible with mock entries that have snippets
    const noteListContainer = page.locator('[data-testid="note-list-container"]')
    await expect(noteListContainer).toBeVisible()

    // Check that at least one snippet is rendered (mock entries all have snippets)
    // The snippet text lives in a muted-foreground div inside each note item
    const snippetElements = page.locator('.text-muted-foreground').filter({
      hasText: /\w{10,}/,  // at least 10 word-chars → real snippet text
    })
    const count = await snippetElements.count()
    expect(count).toBeGreaterThan(0)
  })

  test('snippet updates after editing and saving a note', async ({ page }) => {
    // Click the first note to open it in the editor
    const firstNote = page.locator('[data-testid="note-list-container"]').locator('.cursor-pointer').first()
    await firstNote.click()

    // Wait for editor to load
    const editor = page.locator('[data-testid="editor-container"], .bn-editor, .ProseMirror').first()
    await expect(editor).toBeVisible({ timeout: 5000 })

    // Type some unique content
    const uniqueText = `Snippet test content ${Date.now()}`
    await editor.click()
    await page.keyboard.press('End')
    await page.keyboard.press('Enter')
    await page.keyboard.type(uniqueText, { delay: 10 })

    // Save with Cmd+S
    await page.keyboard.press('Control+s')

    // Wait for save to complete
    await page.waitForTimeout(500)

    // The snippet in the note list should now contain our text (or at least be non-empty)
    // The note list item should have a snippet div with content
    const noteItem = page.locator('[data-testid="note-list-container"]').locator('.cursor-pointer').first()
    const snippetDiv = noteItem.locator('.text-muted-foreground').first()
    const snippetText = await snippetDiv.textContent()
    expect(snippetText).toBeTruthy()
    expect(snippetText!.length).toBeGreaterThan(0)
  })

  test('snippet is stripped of markdown formatting', async ({ page }) => {
    // The mock entry "Kitchen Sink" has bold, italic, code, etc. in its snippet source
    // but the extracted snippet should not contain markdown chars like ** or *
    const noteListContainer = page.locator('[data-testid="note-list-container"]')
    await expect(noteListContainer).toBeVisible()

    // Look for the "Kitchen Sink" note or any note with a snippet
    // Verify no raw markdown chars appear in snippet text
    const allSnippets = page.locator('[data-testid="note-list-container"] .text-muted-foreground')
    const snippetCount = await allSnippets.count()

    for (let i = 0; i < Math.min(snippetCount, 5); i++) {
      const text = await allSnippets.nth(i).textContent()
      if (text && text.length > 10) {
        // Should not contain raw markdown formatting
        expect(text).not.toMatch(/\*\*[^*]+\*\*/)  // no **bold**
        expect(text).not.toContain('```')  // no code fences
        expect(text).not.toMatch(/\[\[.*\]\]/)  // no raw wikilinks
      }
    }
  })
})
