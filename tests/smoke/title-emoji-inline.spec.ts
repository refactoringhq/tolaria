import { test, expect } from '@playwright/test'

test.describe('Title H1 with inline emoji', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.waitForTimeout(500)

    // Open a note so TitleField is visible
    const noteItem = page.locator('.app__note-list .cursor-pointer').first()
    await noteItem.click()
    await page.waitForTimeout(500)
  })

  test('title-section__row is a horizontal flex container', async ({ page }) => {
    const row = page.locator('.title-section__row')
    await expect(row).toBeVisible({ timeout: 3000 })

    const display = await row.evaluate(el => getComputedStyle(el).display)
    const flexDir = await row.evaluate(el => getComputedStyle(el).flexDirection)
    expect(display).toBe('flex')
    expect(flexDir).toBe('row')
  })

  test('title field renders with large H1 font size', async ({ page }) => {
    const input = page.locator('.title-field__input')
    await expect(input).toBeVisible({ timeout: 3000 })

    const fontSize = await input.evaluate(el => {
      const computed = getComputedStyle(el)
      return parseFloat(computed.fontSize)
    })
    // Title must be at least 24px (H1 style, significantly larger than body ~16px)
    expect(fontSize).toBeGreaterThanOrEqual(24)
  })

  test('title field renders with bold font weight', async ({ page }) => {
    const input = page.locator('.title-field__input')
    await expect(input).toBeVisible({ timeout: 3000 })

    const fontWeight = await input.evaluate(el => {
      const computed = getComputedStyle(el)
      return parseInt(computed.fontWeight, 10)
    })
    // Font weight 700+ (bold or heavier)
    expect(fontWeight).toBeGreaterThanOrEqual(700)
  })

  test('emoji icon and title are on the same horizontal line when icon present', async ({ page }) => {
    // Add an icon via the "Add icon" button
    const iconArea = page.locator('[data-testid="note-icon-area"]')
    await iconArea.hover()
    await page.waitForTimeout(200)

    const addBtn = page.locator('[data-testid="note-icon-add"]')
    if (await addBtn.isVisible()) {
      await addBtn.click()
      await page.waitForTimeout(300)

      // Pick the first emoji in the picker
      const emojiBtn = page.locator('.emoji-picker-grid button').first()
      if (await emojiBtn.isVisible()) {
        await emojiBtn.click()
        await page.waitForTimeout(300)
      }
    }

    const iconDisplay = page.locator('[data-testid="note-icon-display"]')
    const titleInput = page.locator('[data-testid="title-field-input"]')

    if (await iconDisplay.isVisible()) {
      const iconBox = await iconDisplay.boundingBox()
      const titleBox = await titleInput.boundingBox()

      expect(iconBox).not.toBeNull()
      expect(titleBox).not.toBeNull()

      // Emoji and title must be on the same row: their vertical centers overlap
      const iconCenter = iconBox!.y + iconBox!.height / 2
      const titleTop = titleBox!.y
      const titleBottom = titleBox!.y + titleBox!.height

      expect(iconCenter).toBeGreaterThanOrEqual(titleTop - 8)
      expect(iconCenter).toBeLessThanOrEqual(titleBottom + 8)

      // Emoji must be to the left of the title
      expect(iconBox!.x).toBeLessThan(titleBox!.x)
    }
  })

  test('clicking title still enters edit mode', async ({ page }) => {
    const titleInput = page.locator('[data-testid="title-field-input"]')
    await expect(titleInput).toBeVisible({ timeout: 3000 })

    await titleInput.click()
    await expect(titleInput).toBeFocused()
  })
})
