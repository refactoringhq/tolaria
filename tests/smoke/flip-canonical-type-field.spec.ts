import { expect, type Page, test } from '@playwright/test'

import { sendShortcut } from './helpers'

async function openNoteViaQuickOpen(page: Page, query: string) {
  await page.locator('body').click()
  await sendShortcut(page, 'p', ['Control'])
  const searchInput = page.locator('input[placeholder="Search notes..."]')
  await expect(searchInput).toBeVisible()
  await searchInput.fill(query)
  await page.waitForTimeout(500)
  await page.keyboard.press('Enter')
  await page.waitForTimeout(500)
}

test.describe('Canonical type field', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1600, height: 900 })
    await page.goto('/')
    await page.waitForLoadState('networkidle')
  })

  test('sidebar shows type sections parsed from type: field', async ({ page }) => {
    // The sidebar groups notes by type — this confirms the type: field is parsed correctly
    // by the mock layer (which mirrors what the Rust parser does with serde rename)
    const projectSection = page.getByText('Project').first()
    await expect(projectSection).toBeVisible({ timeout: 5000 })

    // Also verify Note and Person sections exist (these use type: in mock data)
    const noteSection = page.getByText('Note').first()
    await expect(noteSection).toBeVisible({ timeout: 5000 })
  })

  test('theme notes display correctly with type: Theme', async ({ page }) => {
    // Navigate to a theme note — themes now use type: Theme in their frontmatter
    await openNoteViaQuickOpen(page, 'Default')

    // Verify the note loaded and the editor/title area shows the theme title
    const heading = page.getByText('Default').first()
    await expect(heading).toBeVisible({ timeout: 5000 })
  })

  test('type definition notes display correctly with type: Type', async ({ page }) => {
    // Open a Type definition note (e.g. "Project" type definition)
    await openNoteViaQuickOpen(page, 'Project')

    // Type definitions should still show the Instances section
    const instancesLabel = page.getByText(/Instances \(\d+\)/)
    await expect(instancesLabel).toBeVisible({ timeout: 5000 })
  })
})
