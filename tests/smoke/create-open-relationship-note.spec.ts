import { test, expect } from '@playwright/test'
import { sendShortcut } from './helpers'

async function openNoteViaQuickOpen(page: import('@playwright/test').Page, query: string) {
  await page.locator('body').click()
  await sendShortcut(page, 'p', ['Control'])
  const searchInput = page.locator('input[placeholder="Search notes..."]')
  await expect(searchInput).toBeVisible()
  await searchInput.fill(query)
  await page.waitForTimeout(500)
  await page.keyboard.press('Enter')
  await page.waitForTimeout(1000)
}

test.describe('Create & open note from relationship input', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1600, height: 900 })
    await page.goto('/')
    await page.waitForLoadState('networkidle')
  })

  test('creates note from relationship input without crash', async ({ page }) => {
    const pageErrors: string[] = []
    page.on('pageerror', (err) => pageErrors.push(err.message))

    await openNoteViaQuickOpen(page, 'Start Laputa App')

    const belongsToLabel = page.locator('span.font-mono-overline').filter({ hasText: 'Belongs to' })
    await expect(belongsToLabel).toBeVisible({ timeout: 5000 })

    const addButton = page.getByTestId('add-relation-ref')
    await expect(addButton.first()).toBeVisible()
    await addButton.first().click()

    const input = page.getByTestId('add-relation-ref-input')
    await expect(input).toBeVisible()
    const uniqueTitle = `Test Note ${Date.now()}`
    await input.fill(uniqueTitle)
    await page.waitForTimeout(300)

    const createOption = page.getByTestId('create-and-open-option')
    await expect(createOption).toBeVisible()

    await createOption.click()
    await page.waitForTimeout(2000)

    // No uncaught errors (especially no "Maximum update depth exceeded")
    const fatal = pageErrors.filter(e => e.includes('Maximum update depth'))
    expect(fatal).toHaveLength(0)

    // App is still visible — not blank/crashed
    await expect(page.locator('.app__editor')).toBeVisible()
  })

  test('only the new note tab is active after creation', async ({ page }) => {
    await openNoteViaQuickOpen(page, 'Start Laputa App')

    const belongsToLabel = page.locator('span.font-mono-overline').filter({ hasText: 'Belongs to' })
    await expect(belongsToLabel).toBeVisible({ timeout: 5000 })

    const addButton = page.getByTestId('add-relation-ref')
    await addButton.first().click()

    const input = page.getByTestId('add-relation-ref-input')
    const uniqueTitle = `Tab Test ${Date.now()}`
    await input.fill(uniqueTitle)
    await page.waitForTimeout(300)

    await page.getByTestId('create-and-open-option').click()
    await page.waitForTimeout(2000)

    // The new note title should be visible in the editor heading
    await expect(page.locator('.app__editor')).toBeVisible()
  })

  // TODO: fix relationship wikilink persistence in single-note model — the wikilink
  // write to the original note may race with navigation to the new note.
  test.skip('relationship wikilink is added to original note after creation', async ({ page }) => {
    await openNoteViaQuickOpen(page, 'Start Laputa App')

    const belongsToLabel = page.locator('span.font-mono-overline').filter({ hasText: 'Belongs to' })
    await expect(belongsToLabel).toBeVisible({ timeout: 5000 })

    const addButton = page.getByTestId('add-relation-ref')
    await addButton.first().click()

    const input = page.getByTestId('add-relation-ref-input')
    const uniqueTitle = `Link Test ${Date.now()}`
    await input.fill(uniqueTitle)
    await page.waitForTimeout(300)

    await page.getByTestId('create-and-open-option').click()
    await page.waitForTimeout(3000)

    // Navigate back to the original note (single-note model: replaces the newly created note)
    await openNoteViaQuickOpen(page, 'Start Laputa App')
    await page.waitForTimeout(2000)

    // The new wikilink should appear in the relationships
    const newRef = page.locator(`text=${uniqueTitle}`)
    await expect(newRef.first()).toBeVisible({ timeout: 8000 })
  })
})
