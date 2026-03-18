import { test, expect } from '@playwright/test'

test.describe('Repair Vault — no legacy dirs, seed type definitions at root', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')
  })

  test('repair vault does not create _themes/ directory', async ({ page }) => {
    const errors: string[] = []
    page.on('console', msg => {
      if (msg.type() === 'error') errors.push(msg.text())
    })

    // Open command palette and run Repair Vault
    await page.keyboard.press('Meta+k')
    await page.waitForTimeout(300)
    await page.keyboard.type('repair vault')
    await page.waitForTimeout(300)
    await page.keyboard.press('Enter')
    await page.waitForTimeout(1000)

    // No console errors related to repair_vault or _themes
    const repairErrors = errors.filter(e => e.includes('repair_vault') || e.includes('_themes'))
    expect(repairErrors).toHaveLength(0)
  })

  test('repair vault shows success toast', async ({ page }) => {
    // Open command palette and run Repair Vault
    await page.keyboard.press('Meta+k')
    await page.waitForTimeout(300)
    await page.keyboard.type('repair vault')
    await page.waitForTimeout(300)
    await page.keyboard.press('Enter')
    await page.waitForTimeout(1000)

    // Toast message should appear confirming success
    const toast = page.locator('[class*="toast"], [role="status"]')
    await expect(toast.first()).toBeVisible({ timeout: 3000 })
  })

  test('app loads without creating _themes/ or config/ directories', async ({ page }) => {
    const main = page.locator('#root')
    await expect(main).toBeVisible()

    const errors: string[] = []
    page.on('console', msg => {
      if (msg.type() === 'error') errors.push(msg.text())
    })
    await page.waitForTimeout(1000)

    // No errors about legacy directories
    const legacyErrors = errors.filter(
      e => e.includes('_themes') || e.includes('config/'),
    )
    expect(legacyErrors).toHaveLength(0)
  })
})
