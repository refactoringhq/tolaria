import { test, expect } from '@playwright/test'
import { createFixtureVaultCopy, openFixtureVault, removeFixtureVaultCopy } from '../helpers/fixtureVault'
import { executeCommand, openCommandPalette } from './helpers'

test('opens a non-git vault and initializes Git later from the keyboard @smoke', async ({ page }) => {
  const tempVaultDir = createFixtureVaultCopy()

  try {
    await openFixtureVault(page, tempVaultDir, { isGitRepo: false })

    await expect(page.getByTestId('note-list-container')).toBeVisible()
    await expect(page.getByText('Alpha Project', { exact: true }).first()).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Enable Git for this vault?' })).toBeVisible()

    await page.keyboard.press('Escape')
    await expect(page.getByRole('heading', { name: 'Enable Git for this vault?' })).not.toBeVisible()
    const sync = page.getByTestId('sidebar-sync')
    const history = page.getByRole('menuitem', { name: 'View history' })
    await sync.press('Enter')
    await expect(history).toBeDisabled()
    await page.keyboard.press('Escape')

    await openCommandPalette(page)
    await executeCommand(page, 'Initialize Git')

    await expect(page.getByRole('heading', { name: 'Enable Git for this vault?' })).toBeVisible()
    await page.getByRole('button', { name: 'Initialize Git' }).focus()
    await page.keyboard.press('Enter')

    await expect(page.getByRole('heading', { name: 'Enable Git for this vault?' })).not.toBeVisible()
    await sync.press('Enter')
    await expect(history).toBeEnabled()
  } finally {
    removeFixtureVaultCopy(tempVaultDir)
  }
})
