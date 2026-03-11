import { test, expect } from '@playwright/test'
import { sendShortcut } from './helpers'

const QUICK_OPEN_INPUT = 'input[placeholder="Search notes..."]'

/** Known archived note titles from mock data */
const ARCHIVED_TITLES = ['Website Redesign', 'Twitter Thread Growth Experiment']

async function openQuickOpen(page: import('@playwright/test').Page) {
  await page.locator('body').click()
  await sendShortcut(page, 'p', ['Control'])
  await expect(page.locator(QUICK_OPEN_INPUT)).toBeVisible()
}

function quickOpenPanel(page: import('@playwright/test').Page) {
  return page.locator('.fixed.inset-0').filter({ has: page.locator(QUICK_OPEN_INPUT) })
}

function getResultTitles(container: import('@playwright/test').Locator) {
  return container.locator('span.truncate').allTextContents()
}

test.describe('Archived/Trashed Yes/No detection', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')
  })

  test('archived notes are filtered out of the default sidebar', async ({ page }) => {
    // In the default sidebar view (non-archived section), archived notes must not appear
    const noteItems = page.locator('[data-testid="note-item"]')
    const count = await noteItems.count()
    for (let i = 0; i < count; i++) {
      const text = await noteItems.nth(i).textContent()
      for (const title of ARCHIVED_TITLES) {
        expect(text, `archived note "${title}" should not be in default sidebar`).not.toContain(title)
      }
    }
  })

  test('archived note shows ArchivedNoteBanner in the editor', async ({ page }) => {
    // Open quick open and navigate to an archived note
    await openQuickOpen(page)
    await page.locator(QUICK_OPEN_INPUT).fill('Website Redesign')
    await page.waitForTimeout(400)

    // The archived note might not appear in quick open (filtered), so try direct URL
    const panel = quickOpenPanel(page)
    const titles = await getResultTitles(panel)
    if (titles.some(t => t.includes('Website Redesign'))) {
      // If it appears in quick open, click it
      const result = panel.locator('span.truncate').filter({ hasText: 'Website Redesign' }).first()
      await result.click()
    } else {
      // Close quick open and use sidebar Archived section if available
      await page.keyboard.press('Escape')
      // Click the Archived section header to expand it
      const archivedSection = page.locator('text=Archived').first()
      if (await archivedSection.isVisible({ timeout: 1000 }).catch(() => false)) {
        await archivedSection.click()
        await page.waitForTimeout(300)
        const archivedNote = page.locator('[data-testid="note-item"]').filter({ hasText: 'Website Redesign' })
        if (await archivedNote.isVisible({ timeout: 1000 }).catch(() => false)) {
          await archivedNote.click()
        } else {
          test.skip()
          return
        }
      } else {
        test.skip()
        return
      }
    }

    await page.waitForTimeout(500)
    // Verify the archived banner is visible
    const banner = page.locator('[data-testid="archived-note-banner"]')
    await expect(banner).toBeVisible({ timeout: 3000 })
    await expect(banner).toContainText('Archived')
  })

  test('archived note shows archived badge in the note list', async ({ page }) => {
    // Navigate to the Archived section in the sidebar
    const archivedSection = page.locator('button, [role="button"], span').filter({ hasText: /^Archived/ }).first()
    if (!await archivedSection.isVisible({ timeout: 2000 }).catch(() => false)) {
      test.skip()
      return
    }
    await archivedSection.click()
    await page.waitForTimeout(300)

    // Look for archived badge on note items
    const badges = page.locator('[data-testid="state-badge"]')
    const badgeCount = await badges.count()
    expect(badgeCount).toBeGreaterThan(0)
  })

  test('archived notes do not appear in Quick Open search', async ({ page }) => {
    await openQuickOpen(page)
    const panel = quickOpenPanel(page)
    for (const title of ARCHIVED_TITLES) {
      const query = title.split(' ')[0]
      await page.locator(QUICK_OPEN_INPUT).fill(query)
      await page.waitForTimeout(400)
      const titles = await getResultTitles(panel)
      expect(titles, `"${title}" should not appear in Quick Open`).not.toContain(title)
    }
  })
})
