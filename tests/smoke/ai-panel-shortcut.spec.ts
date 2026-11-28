import { expect, test } from '@playwright/test'
import {
  createFixtureVaultCopy,
  openFixtureVaultDesktopHarness,
  removeFixtureVaultCopy,
} from '../helpers/fixtureVault'

test('the AI shortcut opens the workspace from the note editor', async ({ page }) => {
  const vault = createFixtureVaultCopy()
  try {
    await openFixtureVaultDesktopHarness(page, vault, { expectedReadyTitle: 'Note B' })
    await page.getByTestId('note-list-container').getByText('Note B', { exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Note B', exact: true })).toBeVisible()
    await page.locator('.bn-editor').click()

    const macUserAgent = await page.evaluate(() => /Macintosh|Mac OS X/.test(navigator.userAgent))
    await page.keyboard.press(macUserAgent ? 'Meta+Shift+L' : 'Control+Shift+L')

    const workspace = page.locator('.app__editor [data-ai-workspace-mode="side"]')
    await expect(workspace).toBeVisible({ timeout: 3_000 })
    await expect(workspace.getByRole('button', { name: 'Close AI workspace', exact: true })).toBeVisible()
  } finally {
    removeFixtureVaultCopy(vault)
  }
})
