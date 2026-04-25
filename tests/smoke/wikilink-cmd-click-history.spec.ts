import { test, expect, type Page } from '@playwright/test'
import {
  createFixtureVaultCopy,
  openFixtureVaultDesktopHarness,
  removeFixtureVaultCopy,
} from '../helpers/fixtureVault'

let tempVaultDir: string

async function openNote(page: Page, title: string) {
  const noteList = page.locator('[data-testid="note-list-container"]')
  await noteList.getByText(title, { exact: true }).click()
}

async function expectActiveHeading(page: Page, title: string) {
  await expect(page.locator('.bn-editor h1').first()).toHaveText(title, { timeout: 5_000 })
}

test.beforeEach(async ({ page }, testInfo) => {
  testInfo.setTimeout(60_000)
  await page.goto('/')
  await page.waitForLoadState('networkidle')
  tempVaultDir = createFixtureVaultCopy()
  await openFixtureVaultDesktopHarness(page, tempVaultDir)
})

test.afterEach(() => {
  removeFixtureVaultCopy(tempVaultDir)
})

test('@smoke Cmd-clicking an existing wikilink preserves Back/Forward history', async ({ page }) => {
  await openNote(page, 'Alpha Project')
  await expectActiveHeading(page, 'Alpha Project')

  const wikilink = page.locator('.bn-editor .wikilink').filter({ hasText: 'Note B' }).first()
  await expect(wikilink).toBeVisible()

  await wikilink.click({ modifiers: ['Meta'] })
  await expectActiveHeading(page, 'Note B')

  await page.keyboard.press('Meta+ArrowLeft')
  await expectActiveHeading(page, 'Alpha Project')

  await page.keyboard.press('Meta+ArrowRight')
  await expectActiveHeading(page, 'Note B')

  await openNote(page, 'Note C')
  await expectActiveHeading(page, 'Note C')

  await page.keyboard.press('Meta+ArrowLeft')
  await expectActiveHeading(page, 'Note B')
})
