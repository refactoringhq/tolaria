import { expect, type Page, test } from '@playwright/test'


// On macOS, Alt+key produces special characters, so we dispatch events directly
function dispatchAltKey(page: Page, key: string) {
  return page.evaluate((k) => {
    window.dispatchEvent(new KeyboardEvent('keydown', {
      key: k, altKey: true, metaKey: false, ctrlKey: false,
      bubbles: true, cancelable: true,
    }))
  }, key)
}

async function loadApp(page: Page) {
  await page.goto('/')
  // Clear stored view mode so we start fresh
  await page.evaluate(() => localStorage.removeItem('laputa-view-mode'))
  await page.reload()
  await page.waitForTimeout(500)
}

test.describe('Sidebar collapse', () => {
  test('default: all three panels visible', async ({ page }) => {
    await loadApp(page)

    await expect(page.locator('.app__sidebar')).toBeVisible()
    await expect(page.locator('.app__note-list')).toBeVisible()
    await expect(page.locator('.app__editor')).toBeVisible()

    await page.screenshot({ path: 'test-results/collapse-all-panels.png', fullPage: true })
  })

  test('collapse button hides sidebar', async ({ page }) => {
    await loadApp(page)

    const collapseBtn = page.locator('button[aria-label="Collapse sidebar"]')
    await expect(collapseBtn).toBeVisible()
    await collapseBtn.click()
    await page.waitForTimeout(500)

    await expect(page.locator('.app__sidebar')).toHaveCount(0)
    await expect(page.locator('.app__note-list')).toBeVisible()
    await expect(page.locator('.app__editor')).toBeVisible()

    await page.screenshot({ path: 'test-results/collapse-sidebar-hidden.png', fullPage: true })
  })

  test('Alt+1 shows editor only', async ({ page }) => {
    await loadApp(page)

    await dispatchAltKey(page, '1')
    await page.waitForTimeout(500)

    await expect(page.locator('.app__sidebar')).toHaveCount(0)
    await expect(page.locator('.app__note-list')).toHaveCount(0)
    await expect(page.locator('.app__editor')).toBeVisible()

    await page.screenshot({ path: 'test-results/collapse-editor-only.png', fullPage: true })
  })

  test('Alt+2 shows editor + note list', async ({ page }) => {
    await loadApp(page)

    await dispatchAltKey(page, '2')
    await page.waitForTimeout(500)

    await expect(page.locator('.app__sidebar')).toHaveCount(0)
    await expect(page.locator('.app__note-list')).toBeVisible()
    await expect(page.locator('.app__editor')).toBeVisible()

    await page.screenshot({ path: 'test-results/collapse-editor-list.png', fullPage: true })
  })

  test('Alt+3 restores all panels after collapse', async ({ page }) => {
    await loadApp(page)

    // Collapse first
    await dispatchAltKey(page, '1')
    await page.waitForTimeout(500)
    await expect(page.locator('.app__sidebar')).toHaveCount(0)

    // Restore
    await dispatchAltKey(page, '3')
    await page.waitForTimeout(500)
    await expect(page.locator('.app__sidebar')).toBeVisible()
    await expect(page.locator('.app__note-list')).toBeVisible()
    await expect(page.locator('.app__editor')).toBeVisible()

    await page.screenshot({ path: 'test-results/collapse-restored.png', fullPage: true })
  })
})
