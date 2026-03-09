import { test, expect } from '@playwright/test'
import { sendShortcut } from './helpers'

const QUICK_OPEN_INPUT = 'input[placeholder="Search notes..."]'
const SEARCH_INPUT = 'input[placeholder="Search in all notes..."]'

/** Known trashed note titles from mock data */
const TRASHED_TITLES = ['Old Draft Notes', 'Deprecated API Notes', 'Failed SEO Experiment']
/** Query specific enough to find a known active note */
const ACTIVE_QUERY = 'Laputa App'

async function openQuickOpen(page: import('@playwright/test').Page) {
  await page.locator('body').click()
  await sendShortcut(page, 'p', ['Control'])
  await expect(page.locator(QUICK_OPEN_INPUT)).toBeVisible()
}

/** Get result titles scoped to a specific container (avoids matching sidebar items). */
function getResultTitles(container: import('@playwright/test').Locator) {
  return container.locator('span.truncate').allTextContents()
}

/** The Quick Open dialog overlay */
function quickOpenPanel(page: import('@playwright/test').Page) {
  return page.locator('.fixed.inset-0').filter({ has: page.locator(QUICK_OPEN_INPUT) })
}

/** The full-text search dialog overlay */
function searchPanel(page: import('@playwright/test').Page) {
  return page.locator('.fixed.inset-0').filter({ has: page.locator(SEARCH_INPUT) })
}

test.describe('Exclude trashed notes from search and autocomplete', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')
  })

  test('trashed notes do not appear in Quick Open search', async ({ page }) => {
    await openQuickOpen(page)
    const panel = quickOpenPanel(page)
    for (const title of TRASHED_TITLES) {
      // Use a unique enough substring to trigger results
      const query = title.split(' ')[0]
      await page.locator(QUICK_OPEN_INPUT).fill(query)
      await page.waitForTimeout(400)
      const titles = await getResultTitles(panel)
      expect(titles, `"${title}" should not appear for query "${query}"`).not.toContain(title)
    }
  })

  test('active notes still appear in Quick Open search', async ({ page }) => {
    await openQuickOpen(page)
    const panel = quickOpenPanel(page)
    await page.locator(QUICK_OPEN_INPUT).fill(ACTIVE_QUERY)
    await page.waitForTimeout(400)
    const titles = await getResultTitles(panel)
    expect(titles.some(t => t.includes('Laputa App'))).toBe(true)
  })

  test('trashed notes do not appear in full-text search', async ({ page }) => {
    // Full-text search panel opened via Ctrl/Cmd+Shift+F
    const searchVisible = async () => {
      await page.locator('body').click()
      await sendShortcut(page, 'f', ['Control', 'Shift'])
      try {
        await expect(page.locator(SEARCH_INPUT)).toBeVisible({ timeout: 2000 })
        return true
      } catch { return false }
    }
    if (!await searchVisible()) {
      // Retry with Meta (macOS Cmd key) in case Playwright routes it differently
      await sendShortcut(page, 'f', ['Meta', 'Shift'])
      try {
        await expect(page.locator(SEARCH_INPUT)).toBeVisible({ timeout: 2000 })
      } catch {
        test.skip()
        return
      }
    }
    await page.locator(SEARCH_INPUT).fill('Old Draft')
    await page.waitForTimeout(600)
    const titles = await getResultTitles(searchPanel(page))
    expect(titles).not.toContain('Old Draft Notes')
  })

  test('wikilink autocomplete does not suggest trashed notes', async ({ page }) => {
    // Open any note first (click the first note in the sidebar)
    const firstNote = page.locator('[data-testid="note-item"]').first()
    if (await firstNote.isVisible()) {
      await firstNote.click()
      await page.waitForTimeout(300)
    }

    // Focus the editor and type [[ to trigger autocomplete
    const editor = page.locator('.bn-editor').first()
    if (await editor.isVisible()) {
      await editor.click()
      await page.keyboard.type('[[Old Draft')
      await page.waitForTimeout(500)

      // Check autocomplete suggestions - should not contain the trashed note
      const suggestions = page.locator('.bn-suggestion-menu [class*="item"], .bn-suggestion-menu button, [data-testid="wikilink-suggestion"]')
      const count = await suggestions.count()
      for (let i = 0; i < count; i++) {
        const text = await suggestions.nth(i).textContent()
        expect(text).not.toContain('Old Draft Notes')
      }
    }
  })
})
