import { test, expect, type Page } from '@playwright/test'
import { createFixtureVaultCopy, openFixtureVault, removeFixtureVaultCopy } from '../helpers/fixtureVault'

const SOURCE_NOTE_TITLE = 'Alpha Project'
const INSERTED_WIKILINK_QUERY = '[[No'
const INSERTED_WIKILINK_TITLE = 'Note C'
const SOURCE_NOTE_BODY = 'This is a test project that references other notes.'

let tempVaultDir: string

async function insertWikilink(page: Page) {
  const editor = page.locator('.bn-editor')
  await expect(editor).toBeVisible({ timeout: 5000 })

  const firstParagraph = editor.locator('p').first()
  await expect(
    firstParagraph,
  ).toContainText(SOURCE_NOTE_BODY, { timeout: 5000 })
  await firstParagraph.click()
  await page.keyboard.press('End')
  await page.keyboard.press('Enter')
  await page.waitForTimeout(200)

  await page.keyboard.type(INSERTED_WIKILINK_QUERY)

  const suggestionMenu = page.locator('.wikilink-menu')
  await expect(suggestionMenu).toBeVisible({ timeout: 5000 })
  const matchingWikilinks = editor.locator('.wikilink').filter({ hasText: INSERTED_WIKILINK_TITLE })
  const existingCount = await matchingWikilinks.count()
  await suggestionMenu.getByText(INSERTED_WIKILINK_TITLE, { exact: true }).click()
  await page.waitForTimeout(500)

  await expect(matchingWikilinks).toHaveCount(existingCount + 1)
  return matchingWikilinks.nth(existingCount)
}

test.describe('Wikilink insertion and navigation', () => {
  test.beforeEach(async ({ page }) => {
    tempVaultDir = createFixtureVaultCopy()
    await openFixtureVault(page, tempVaultDir)

    const noteItem = page.getByTestId('note-list-container').getByText(SOURCE_NOTE_TITLE, { exact: true }).first()
    await noteItem.click()
    await page.waitForTimeout(1000)
  })

  test.afterEach(async () => {
    removeFixtureVaultCopy(tempVaultDir)
  })

  test('[[ autocomplete inserts wikilink that is not broken', async ({ page }) => {
    const wikilink = await insertWikilink(page)

    const isBroken = await wikilink.evaluate(
      el => el.classList.contains('wikilink--broken'),
    )
    expect(isBroken).toBe(false)

    const target = await wikilink.getAttribute('data-target')
    expect(target).toBeTruthy()
  })

  test('@smoke Cmd+clicking an inserted wikilink navigates to the note', async ({ page }) => {
    const wikilink = await insertWikilink(page)
    await expect(wikilink).toBeVisible()

    await wikilink.click({ modifiers: ['Meta'] })
    await expect(page.locator('.bn-editor h1').first()).toHaveText(INSERTED_WIKILINK_TITLE, { timeout: 5000 })
  })
})
