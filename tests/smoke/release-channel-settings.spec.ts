import { expect, type Page, test } from '@playwright/test'

import { openCommandPalette, executeCommand } from './helpers'

async function openSettings(page: Page) {
  await page.locator('body').click()
  await page.keyboard.press('Meta+,')
  const panel = page.locator('[data-testid="settings-panel"]')
  try {
    await panel.waitFor({ timeout: 2000 })
    return panel
  } catch {
    await openCommandPalette(page)
    await executeCommand(page, 'Settings')
    await panel.waitFor({ timeout: 5000 })
  }
  return panel
}

test.describe('Release channel settings', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')
  })

  test('Settings panel defaults the release channel to Stable', async ({ page }) => {
    await openSettings(page)

    const trigger = page.locator('[data-testid="settings-release-channel"]')
    await expect(trigger).toBeVisible()
    await expect(trigger).toHaveAttribute('data-value', 'stable')

    await trigger.click()
    await expect(page.getByRole('option', { name: 'Stable' })).toBeVisible()
    await expect(page.getByRole('option', { name: 'Alpha' })).toBeVisible()
    await expect(page.getByRole('option', { name: 'Beta' })).toHaveCount(0)
  })

  test('Release channel can be changed to alpha and saved', async ({ page }) => {
    await openSettings(page)

    const trigger = page.locator('[data-testid="settings-release-channel"]')
    await trigger.click()
    await page.getByRole('option', { name: 'Alpha' }).click()
    await expect(trigger).toHaveAttribute('data-value', 'alpha')

    await page.click('[data-testid="settings-save"]')
    await page.waitForTimeout(500)

    await openSettings(page)
    await expect(page.locator('[data-testid="settings-release-channel"]')).toHaveAttribute('data-value', 'alpha')
  })
})
