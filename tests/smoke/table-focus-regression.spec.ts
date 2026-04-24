import { test, expect, type Page } from '@playwright/test'
import { createFixtureVaultCopy, openFixtureVaultTauri, removeFixtureVaultCopy } from '../helpers/fixtureVault'
import { seedBlockNoteTable, triggerMenuCommand } from './testBridge'

let tempVaultDir: string

function trackUnexpectedErrors(page: Page): string[] {
  const errors: string[] = []

  page.on('pageerror', (error) => {
    errors.push(error.message)
  })

  page.on('console', (message) => {
    if (message.type() !== 'error') return
    const text = message.text()
    if (text.includes('ws://localhost:9711')) return
    errors.push(text)
  })

  return errors
}

async function createUntitledNote(page: Page): Promise<void> {
  await triggerMenuCommand(page, 'file-new-note')
  await expect(page.locator('.bn-editor')).toBeVisible({ timeout: 5_000 })
}

test.describe('table focus regression', () => {
  test.beforeEach(({ page }, testInfo) => {
    void page
    testInfo.setTimeout(60_000)
    tempVaultDir = createFixtureVaultCopy()
  })

  test.afterEach(() => {
    removeFixtureVaultCopy(tempVaultDir)
  })

  test('table headers stay editable after moving focus back to paragraph content', async ({ page }) => {
    const errors = trackUnexpectedErrors(page)
    const editor = page.getByRole('textbox').last()

    await openFixtureVaultTauri(page, tempVaultDir)
    await createUntitledNote(page)
    await seedBlockNoteTable(page, [180, 120, 120])

    await expect(page.locator('table th')).toHaveCount(3, { timeout: 5_000 })
    await page.locator('table th').first().click()

    const trailingParagraph = page.locator('.bn-editor [data-content-type="paragraph"]').last()
    await trailingParagraph.click()
    await page.keyboard.type('typed after table focus')

    await expect(editor).toContainText('typed after table focus')
    await expect(page.locator('table')).toHaveCount(1)
    expect(errors).toEqual([])
  })
})
