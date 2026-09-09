import { expect, test, type Page } from '@playwright/test'
import { APP_COMMAND_IDS } from '../../src/hooks/appCommandCatalog'
import {
  createFixtureVaultCopy,
  openFixtureVaultTauri,
  removeFixtureVaultCopy,
} from '../helpers/fixtureVault'
import { triggerMenuCommand } from './testBridge'

let tempVaultDir: string

async function expectTitleEditingFocus(page: Page): Promise<void> {
  await expect(page.locator('.bn-editor')).toBeFocused()
  const titleHeading = page.locator('.bn-editor [data-content-type="heading"]').first()
  await expect.poll(() => titleHeading.evaluate(element => (
    element.contains(window.getSelection()?.anchorNode ?? null)
  ))).toBe(true)
}

test.beforeEach(async ({ page }, testInfo) => {
  testInfo.setTimeout(90_000)
  tempVaultDir = createFixtureVaultCopy()
  await openFixtureVaultTauri(page, tempVaultDir)
})

test.afterEach(() => {
  removeFixtureVaultCopy(tempVaultDir)
})

test('@smoke new-note title stays focused when auto-rename lands during a typing pause', async ({ page }) => {
  await triggerMenuCommand(page, APP_COMMAND_IDS.fileNewNote)
  await expect(page.locator('.bn-editor')).toBeVisible({ timeout: 5_000 })
  await expect(page.getByTestId('breadcrumb-filename-trigger')).toContainText(/untitled-note-\d+/i, {
    timeout: 5_000,
  })
  await expectTitleEditingFocus(page)

  const titleHeading = page.locator('.bn-editor [data-content-type="heading"]').first()
  await page.keyboard.type('Deliberate', { delay: 35 })
  await expect(titleHeading).toContainText('Deliberate')

  await page.waitForTimeout(2_700)
  await expect(page.getByTestId('breadcrumb-filename-trigger')).toContainText('deliberate', {
    timeout: 5_000,
  })
  await expectTitleEditingFocus(page)

  await page.keyboard.type(' focus')
  await expect(titleHeading).toContainText('Deliberate focus')
  await expectTitleEditingFocus(page)

  await page.keyboard.press('Meta+N')
  await expect(page.getByTestId('breadcrumb-filename-trigger')).toContainText(/untitled-note-\d+/i, {
    timeout: 5_000,
  })
  const nextTitleHeading = page.locator('.bn-editor [data-content-type="heading"]').first()
  await nextTitleHeading.click()
  await expectTitleEditingFocus(page)

  await page.keyboard.type('Consecutive', { delay: 35 })
  await page.waitForTimeout(2_700)
  await expect(page.getByTestId('breadcrumb-filename-trigger')).toContainText('consecutive', {
    timeout: 5_000,
  })
  await expectTitleEditingFocus(page)

  await page.keyboard.type(' focus')
  await expect(nextTitleHeading).toContainText('Consecutive focus')
})
