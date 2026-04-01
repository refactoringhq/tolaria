import { test, expect } from '@playwright/test'

/** Errors that indicate the app has crashed (not just minor internal warnings). */
function isCrashError(msg: string): boolean {
  return msg.includes('Maximum update depth') || msg.includes('Invalid hook call') || msg.includes('#185')
}

test('create note via Cmd+N does not crash', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (err) => { if (isCrashError(err.message)) errors.push(err.message) })

  await page.goto(process.env.BASE_URL ?? 'http://localhost:5201')
  await page.waitForSelector('[data-testid="sidebar-top-nav"]', { timeout: 10000 })
  await page.waitForTimeout(500)

  await page.keyboard.press('Meta+n')
  await page.waitForTimeout(2000)

  expect(errors).toHaveLength(0)
  await expect(page.locator('[data-testid="title-field-input"]')).toBeVisible()
})

test('create note via sidebar + button does not crash', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (err) => { if (isCrashError(err.message)) errors.push(err.message) })

  await page.goto(process.env.BASE_URL ?? 'http://localhost:5201')
  await page.waitForSelector('[data-testid="sidebar-top-nav"]', { timeout: 10000 })
  await page.waitForTimeout(500)

  const plusButtons = page.locator('button[aria-label*="Create new"]')
  if (await plusButtons.count() > 0) {
    await plusButtons.first().click()
    await page.waitForTimeout(2000)
  }

  expect(errors).toHaveLength(0)
  await expect(page.locator('[data-testid="title-field-input"]')).toBeVisible()
})
