import { test, expect } from '@playwright/test'

const EDITOR_CONTAINER = '.editor__blocknote-container'

test.describe('Clickable editor empty space — click below content focuses editor', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')
    // Open the first note to mount the editor
    const noteList = page.locator('[data-testid="note-list-container"]')
    await noteList.waitFor({ timeout: 5_000 })
    await noteList.locator('.cursor-pointer').first().click()
    await page.waitForTimeout(500)
    await page.waitForSelector(EDITOR_CONTAINER, { timeout: 5_000 })
  })

  test('container onClick handler focuses the editor', async ({ page }) => {
    // Dispatch a click directly on the container element (simulating empty space click)
    // This is equivalent to a user clicking on the container background, which happens
    // when the editor content is shorter than the container.
    const focused = await page.evaluate((sel) => {
      const container = document.querySelector(sel)
      if (!container) return 'no-container'
      container.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
      const active = document.activeElement
      if (!active) return 'no-active'
      return container.contains(active) ? 'focused' : `active-is-${active.tagName}`
    }, EDITOR_CONTAINER)
    expect(focused).toBe('focused')
  })

  test('editor container has cursor:text CSS for visual affordance', async ({ page }) => {
    // Verify the cursor:text rule is in the stylesheet
    const hasCursorText = await page.evaluate(() => {
      for (const sheet of document.styleSheets) {
        try {
          for (const rule of sheet.cssRules) {
            if (rule instanceof CSSStyleRule &&
                rule.selectorText?.includes('editor__blocknote-container') &&
                rule.style.cursor === 'text') {
              return true
            }
          }
        } catch { /* cross-origin sheets throw */ }
      }
      return false
    })
    expect(hasCursorText).toBe(true)
  })

  test('clicking on actual editor content does not disrupt normal editing', async ({ page }) => {
    const editor = page.locator('.bn-editor').first()
    await editor.waitFor({ timeout: 5_000 })

    await editor.click()
    await page.waitForTimeout(200)

    const editorHasFocus = await page.evaluate(() => {
      const active = document.activeElement
      if (!active) return false
      const container = document.querySelector('.editor__blocknote-container')
      return container?.contains(active) ?? false
    })
    expect(editorHasFocus).toBe(true)
  })
})
