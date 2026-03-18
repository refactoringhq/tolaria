import { test, expect } from '@playwright/test'
import { openCommandPalette, executeCommand } from './helpers'

test.describe('Note icon emoji picker — full emoji set, search, continuous scroll', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')
    // Open the first note to mount the editor
    const noteList = page.locator('[data-testid="note-list-container"]')
    await noteList.waitFor({ timeout: 5_000 })
    await noteList.locator('.cursor-pointer').first().click()
    await page.waitForTimeout(500)
    await page.waitForSelector('[data-testid="note-icon-area"]', { timeout: 5_000 })
  })

  test('add-icon button opens emoji picker', async ({ page }) => {
    // Hover the note-icon-area to reveal the Add icon button
    await page.locator('[data-testid="note-icon-area"]').hover()
    const addBtn = page.locator('[data-testid="note-icon-add"]')
    await addBtn.waitFor({ timeout: 3_000 })
    await addBtn.click()
    await expect(page.locator('[data-testid="emoji-picker"]')).toBeVisible()
  })

  test('emoji picker contains full emoji set (1800+)', async ({ page }) => {
    await page.locator('[data-testid="note-icon-area"]').hover()
    await page.locator('[data-testid="note-icon-add"]').click()
    const emojiCount = await page.locator('[data-testid="emoji-option"]').count()
    expect(emojiCount).toBeGreaterThan(1800)
  })

  test('emoji search by English name works (rocket → 🚀)', async ({ page }) => {
    await page.locator('[data-testid="note-icon-area"]').hover()
    await page.locator('[data-testid="note-icon-add"]').click()
    const searchInput = page.locator('[data-testid="emoji-picker-search"]')
    await searchInput.fill('rocket')
    await page.waitForTimeout(100)
    const results = page.locator('[data-testid="emoji-option"]')
    const count = await results.count()
    expect(count).toBeGreaterThan(0)
    // Verify 🚀 is in the results
    const texts = await results.allTextContents()
    expect(texts).toContain('🚀')
  })

  test('emoji search for "heart" returns results', async ({ page }) => {
    await page.locator('[data-testid="note-icon-area"]').hover()
    await page.locator('[data-testid="note-icon-add"]').click()
    await page.locator('[data-testid="emoji-picker-search"]').fill('heart')
    await page.waitForTimeout(100)
    const results = page.locator('[data-testid="emoji-option"]')
    const count = await results.count()
    expect(count).toBeGreaterThan(5)
  })

  test('emoji search for "fire" finds 🔥', async ({ page }) => {
    await page.locator('[data-testid="note-icon-area"]').hover()
    await page.locator('[data-testid="note-icon-add"]').click()
    await page.locator('[data-testid="emoji-picker-search"]').fill('fire')
    await page.waitForTimeout(100)
    const texts = await page.locator('[data-testid="emoji-option"]').allTextContents()
    expect(texts).toContain('🔥')
  })

  test('all emojis visible in continuous scroll (no category lock)', async ({ page }) => {
    await page.locator('[data-testid="note-icon-area"]').hover()
    await page.locator('[data-testid="note-icon-add"]').click()
    const grid = page.locator('[data-testid="emoji-picker-grid"]')
    // Verify the grid is scrollable (content height > container height)
    const isScrollable = await grid.evaluate(el => el.scrollHeight > el.clientHeight)
    expect(isScrollable).toBe(true)
    // All emojis should be in the DOM (continuous scroll, not category-locked)
    const emojiCount = await page.locator('[data-testid="emoji-option"]').count()
    expect(emojiCount).toBeGreaterThan(1800)
  })

  test('selecting an emoji saves it and shows it in editor', async ({ page }) => {
    await page.locator('[data-testid="note-icon-area"]').hover()
    await page.locator('[data-testid="note-icon-add"]').click()
    // Pick the first emoji
    const firstEmoji = page.locator('[data-testid="emoji-option"]').first()
    const emojiText = await firstEmoji.textContent()
    await firstEmoji.click()
    // Picker should close and emoji should be displayed
    await expect(page.locator('[data-testid="emoji-picker"]')).not.toBeVisible()
    const display = page.locator('[data-testid="note-icon-display"]')
    await expect(display).toBeVisible()
    await expect(display).toHaveText(emojiText!)
  })

  test('clicking set emoji shows change/remove menu', async ({ page }) => {
    // First set an emoji
    await page.locator('[data-testid="note-icon-area"]').hover()
    await page.locator('[data-testid="note-icon-add"]').click()
    await page.locator('[data-testid="emoji-option"]').first().click()
    // Now click the displayed emoji to open menu
    await page.locator('[data-testid="note-icon-display"]').click()
    await expect(page.locator('[data-testid="note-icon-menu"]')).toBeVisible()
    await expect(page.locator('[data-testid="note-icon-change"]')).toBeVisible()
    await expect(page.locator('[data-testid="note-icon-remove"]')).toBeVisible()
  })

  test('remove emoji removes it from display', async ({ page }) => {
    // Set an emoji first
    await page.locator('[data-testid="note-icon-area"]').hover()
    await page.locator('[data-testid="note-icon-add"]').click()
    await page.locator('[data-testid="emoji-option"]').first().click()
    await expect(page.locator('[data-testid="note-icon-display"]')).toBeVisible()
    // Remove it
    await page.locator('[data-testid="note-icon-display"]').click()
    await page.locator('[data-testid="note-icon-remove"]').click()
    await expect(page.locator('[data-testid="note-icon-display"]')).not.toBeVisible()
  })

  test('command palette "Set Note Icon" opens picker', async ({ page }) => {
    await openCommandPalette(page)
    await executeCommand(page, 'Set Note Icon')
    await expect(page.locator('[data-testid="emoji-picker"]')).toBeVisible()
  })

  test('Escape closes the emoji picker', async ({ page }) => {
    await page.locator('[data-testid="note-icon-area"]').hover()
    await page.locator('[data-testid="note-icon-add"]').click()
    await expect(page.locator('[data-testid="emoji-picker"]')).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(page.locator('[data-testid="emoji-picker"]')).not.toBeVisible()
  })

  test('no results shows empty state message', async ({ page }) => {
    await page.locator('[data-testid="note-icon-area"]').hover()
    await page.locator('[data-testid="note-icon-add"]').click()
    await page.locator('[data-testid="emoji-picker-search"]').fill('xyzzyplugh')
    await page.waitForTimeout(100)
    await expect(page.getByText('No emojis found')).toBeVisible()
  })
})
