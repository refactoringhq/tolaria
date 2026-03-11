import { test, expect } from '@playwright/test'
import { openCommandPalette, executeCommand } from './helpers'

test.describe('BlockNote serializer blank lines fix', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1600, height: 900 })
    await page.goto('/')
    await page.waitForLoadState('networkidle')
  })

  test('tight lists are serialized without blank lines between items', async ({ page }) => {
    // 1. Open the first note in the note list (mock content has bullet lists)
    const noteListContainer = page.locator('[data-testid="note-list-container"]')
    await noteListContainer.waitFor({ timeout: 5000 })
    const firstNote = noteListContainer.locator('.cursor-pointer').first()
    await firstNote.click()
    await page.waitForTimeout(500)

    // 2. Wait for the BlockNote editor to render
    const editorContainer = page.locator('.bn-editor')
    await expect(editorContainer).toBeVisible({ timeout: 5000 })
    await page.waitForTimeout(500)

    // 3. Type a character in the editor to trigger serialization
    await editorContainer.click()
    // Move cursor to end of first paragraph and type a space
    await page.keyboard.press('End')
    await page.keyboard.type(' ')
    await page.waitForTimeout(300)

    // 4. Toggle to raw editor to see the serialized content
    await openCommandPalette(page)
    await executeCommand(page, 'Toggle Raw')
    await page.waitForTimeout(500)

    // 5. Read the raw editor content (CodeMirror textarea)
    const rawEditor = page.locator('[data-testid="raw-editor-codemirror"]')
    await expect(rawEditor).toBeVisible({ timeout: 5000 })

    // Get the raw markdown content via the CodeMirror view
    const rawContent = await page.evaluate(() => {
      const el = document.querySelector('[data-testid="raw-editor-codemirror"]')
      if (!el) return ''
      // CodeMirror stores its content in the view
      const cm = el.querySelector('.cm-content')
      return cm?.textContent ?? ''
    })

    // 6. Verify: bullet list items should NOT have blank lines between them
    // The mock content has bullet list items like "- First level item"
    // After BlockNote serialization, they should still be tight (no blank lines)
    expect(rawContent).toBeTruthy()

    // Check there are no patterns like "* item\n\n* item" or "- item\n\n- item"
    // in the serialized output. We look for list markers since the raw editor
    // shows the serialized content.
    const lines = rawContent.split('\n')
    for (let i = 0; i < lines.length - 2; i++) {
      const line = lines[i]
      const nextLine = lines[i + 1]
      const lineAfter = lines[i + 2]
      // If current line is a list item and line after blank is also a list item,
      // that's the bug
      if (/^[-*+]\s/.test(line.trim()) && nextLine?.trim() === '' && /^[-*+]\s/.test(lineAfter?.trim() ?? '')) {
        throw new Error(
          `Found blank line between list items at line ${i + 1}:\n` +
          `  "${line}"\n  (blank)\n  "${lineAfter}"\n` +
          'This indicates the serializer is adding extra blank lines between list items.'
        )
      }
    }
  })

  test('saving without editing does not add whitespace changes', async ({ page }) => {
    // 1. Open the first note
    const noteListContainer = page.locator('[data-testid="note-list-container"]')
    await noteListContainer.waitFor({ timeout: 5000 })
    const firstNote = noteListContainer.locator('.cursor-pointer').first()
    await firstNote.click()
    await page.waitForTimeout(500)

    // 2. Wait for BlockNote to load the note
    const editorContainer = page.locator('.bn-editor')
    await expect(editorContainer).toBeVisible({ timeout: 5000 })
    await page.waitForTimeout(500)

    // 3. Toggle to raw mode to read the note content BEFORE any edits
    await openCommandPalette(page)
    await executeCommand(page, 'Toggle Raw')
    await page.waitForTimeout(500)

    const rawEditor = page.locator('[data-testid="raw-editor-codemirror"]')
    await expect(rawEditor).toBeVisible({ timeout: 5000 })

    const contentBefore = await page.evaluate(() => {
      const el = document.querySelector('[data-testid="raw-editor-codemirror"]')
      const cm = el?.querySelector('.cm-content')
      return cm?.textContent ?? ''
    })

    // 4. Toggle back to WYSIWYG, make no edits, then toggle raw again
    await openCommandPalette(page)
    await executeCommand(page, 'Toggle Raw')
    await page.waitForTimeout(500)

    // Just click the editor without typing
    await page.locator('.bn-editor').click()
    await page.waitForTimeout(300)

    // Toggle raw again to compare
    await openCommandPalette(page)
    await executeCommand(page, 'Toggle Raw')
    await page.waitForTimeout(500)

    const contentAfter = await page.evaluate(() => {
      const el = document.querySelector('[data-testid="raw-editor-codemirror"]')
      const cm = el?.querySelector('.cm-content')
      return cm?.textContent ?? ''
    })

    // 5. Content should be identical (no extra blank lines added)
    expect(contentAfter).toBe(contentBefore)
  })

  test('headings do not have extra blank lines added after them', async ({ page }) => {
    // 1. Open the first note
    const noteListContainer = page.locator('[data-testid="note-list-container"]')
    await noteListContainer.waitFor({ timeout: 5000 })
    const firstNote = noteListContainer.locator('.cursor-pointer').first()
    await firstNote.click()
    await page.waitForTimeout(500)

    const editorContainer = page.locator('.bn-editor')
    await expect(editorContainer).toBeVisible({ timeout: 5000 })

    // 2. Type a character to trigger serialization
    await editorContainer.click()
    await page.keyboard.press('End')
    await page.keyboard.type(' ')
    await page.waitForTimeout(300)

    // 3. Toggle raw editor
    await openCommandPalette(page)
    await executeCommand(page, 'Toggle Raw')
    await page.waitForTimeout(500)

    const rawContent = await page.evaluate(() => {
      const el = document.querySelector('[data-testid="raw-editor-codemirror"]')
      const cm = el?.querySelector('.cm-content')
      return cm?.textContent ?? ''
    })

    // 4. Verify: no heading is followed by more than one blank line
    const lines = rawContent.split('\n')
    for (let i = 0; i < lines.length - 2; i++) {
      if (/^#{1,6}\s/.test(lines[i].trim())) {
        // A heading followed by two consecutive blank lines is the bug
        if (lines[i + 1]?.trim() === '' && lines[i + 2]?.trim() === '') {
          throw new Error(
            `Found multiple blank lines after heading at line ${i + 1}:\n` +
            `  "${lines[i]}"\n  (blank)\n  (blank)\n` +
            'Headings should have at most one blank line after them.'
          )
        }
      }
    }
  })
})
