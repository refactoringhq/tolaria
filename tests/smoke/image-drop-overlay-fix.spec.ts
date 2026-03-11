import { test, expect } from '@playwright/test'

const DROP_OVERLAY = '.editor__drop-overlay'
const EDITOR_CONTAINER = '.editor__blocknote-container'

test.describe('Image drop overlay — internal drag does not trigger overlay', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')
    // Open the first note to mount the editor
    const noteList = page.locator('[data-testid="note-list-container"]')
    await noteList.waitFor({ timeout: 5_000 })
    await noteList.locator('.cursor-pointer').first().click()
    await page.waitForTimeout(300)
    await page.waitForSelector(EDITOR_CONTAINER, { timeout: 5_000 })
  })

  test('internal drag (no image files) does not show the overlay', async ({ page }) => {
    // Simulate an internal drag (e.g. block or tab) — dataTransfer has no files
    await page.locator(EDITOR_CONTAINER).first().dispatchEvent('dragover', {
      bubbles: true,
      cancelable: true,
    })

    // The overlay should NOT appear for non-file drags
    await expect(page.locator(DROP_OVERLAY)).not.toBeVisible()
  })

  test('dragover with image file shows the overlay', async ({ page }) => {
    // Simulate an OS file drag with an image file in dataTransfer
    // Playwright dispatchEvent can't set dataTransfer items directly,
    // so we use page.evaluate to dispatch a proper DragEvent with file items
    await page.evaluate((selector) => {
      const el = document.querySelector(selector)
      if (!el) throw new Error('Editor container not found')

      const dt = new DataTransfer()
      dt.items.add(new File(['fake'], 'photo.png', { type: 'image/png' }))

      const event = new DragEvent('dragover', {
        dataTransfer: dt,
        bubbles: true,
        cancelable: true,
      })
      el.dispatchEvent(event)
    }, EDITOR_CONTAINER)

    await expect(page.locator(DROP_OVERLAY)).toBeVisible()
    await expect(page.locator(DROP_OVERLAY)).toContainText('Drop image here')
  })

  test('dragleave after image dragover hides the overlay', async ({ page }) => {
    // First show the overlay via image dragover
    await page.evaluate((selector) => {
      const el = document.querySelector(selector)
      if (!el) throw new Error('Editor container not found')

      const dt = new DataTransfer()
      dt.items.add(new File(['fake'], 'photo.png', { type: 'image/png' }))
      el.dispatchEvent(new DragEvent('dragover', {
        dataTransfer: dt,
        bubbles: true,
        cancelable: true,
      }))
    }, EDITOR_CONTAINER)

    await expect(page.locator(DROP_OVERLAY)).toBeVisible()

    // Now simulate dragleave (cursor left the container)
    await page.evaluate((selector) => {
      const el = document.querySelector(selector)
      if (!el) throw new Error('Editor container not found')

      el.dispatchEvent(new DragEvent('dragleave', {
        bubbles: true,
        cancelable: true,
        relatedTarget: document.body,
      }))
    }, EDITOR_CONTAINER)

    await expect(page.locator(DROP_OVERLAY)).not.toBeVisible()
  })

  test('drop resets the overlay', async ({ page }) => {
    // Show overlay via image dragover
    await page.evaluate((selector) => {
      const el = document.querySelector(selector)
      if (!el) throw new Error('Editor container not found')

      const dt = new DataTransfer()
      dt.items.add(new File(['fake'], 'photo.png', { type: 'image/png' }))
      el.dispatchEvent(new DragEvent('dragover', {
        dataTransfer: dt,
        bubbles: true,
        cancelable: true,
      }))
    }, EDITOR_CONTAINER)

    await expect(page.locator(DROP_OVERLAY)).toBeVisible()

    // Simulate drop
    await page.evaluate((selector) => {
      const el = document.querySelector(selector)
      if (!el) throw new Error('Editor container not found')

      el.dispatchEvent(new DragEvent('drop', {
        bubbles: true,
        cancelable: true,
      }))
    }, EDITOR_CONTAINER)

    await expect(page.locator(DROP_OVERLAY)).not.toBeVisible()
  })
})
