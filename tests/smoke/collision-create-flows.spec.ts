import { test, expect } from '@playwright/test'
import fs from 'fs'
import path from 'path'
import { createFixtureVaultCopy, openFixtureVaultDesktopHarness, removeFixtureVaultCopy } from '../helpers/fixtureVault'
import { sendShortcut } from './helpers'

let tempVaultDir: string

function writeFixtureNote(vaultPath: string, filename: string, content: string): string {
  const notePath = path.join(vaultPath, filename)
  fs.writeFileSync(notePath, content)
  return notePath
}

function toast(page: import('@playwright/test').Page) {
  return page.locator('.fixed.bottom-8')
}

test.describe('Collision-safe create flows', () => {
  test.beforeEach(async ({ page }) => {
    tempVaultDir = createFixtureVaultCopy()
    await page.setViewportSize({ width: 1600, height: 900 })
  })

  test.afterEach(() => {
    removeFixtureVaultCopy(tempVaultDir)
  })

  test('missing-type creation keeps the dialog open when a root filename already exists', async ({ page }) => {
    const collidingPath = writeFixtureNote(
      tempVaultDir,
      'hotel.md',
      '---\ntype: Note\n---\n# Existing Hotel Note\n',
    )
    writeFixtureNote(
      tempVaultDir,
      'hotel-guide.md',
      '---\ntype: Hotel\nstatus: Active\n---\n# Hotel Guide\n',
    )

    await openFixtureVaultDesktopHarness(page, tempVaultDir)
    await page.getByText('Hotel Guide', { exact: true }).click()
    await sendShortcut(page, 'i', ['Control', 'Shift'])

    const warning = page.getByTestId('missing-type-warning')
    await expect(warning).toBeVisible()
    await warning.focus()
    await page.keyboard.press('Enter')

    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()
    await expect(dialog.getByPlaceholder('e.g. Recipe, Book, Habit...')).toHaveValue('Hotel')
    await page.keyboard.press('Enter')

    await expect(dialog).toBeVisible()
    await expect(toast(page)).toContainText('Cannot create type "Hotel" because hotel.md already exists')
    expect(fs.readFileSync(collidingPath, 'utf8')).toContain('# Existing Hotel Note')
  })

  test('relationship create-and-open keeps the inline input active on filename collision', async ({ page }) => {
    const collidingPath = writeFixtureNote(
      tempVaultDir,
      'briefing.md',
      '---\ntype: Note\n---\n# Weekly Sync\n',
    )

    await openFixtureVaultDesktopHarness(page, tempVaultDir)
    await page.getByText('Team Meeting', { exact: true }).click()
    await sendShortcut(page, 'i', ['Control', 'Shift'])

    const addButton = page.getByTestId('add-relation-ref').first()
    await expect(addButton).toBeVisible()
    await addButton.click()
    const input = page.getByTestId('add-relation-ref-input')
    await expect(input).toBeVisible()
    await input.fill('Briefing!')
    await page.waitForTimeout(300)

    await page.getByTestId('create-and-open-option').click()

    await expect(input).toBeVisible()
    await expect(toast(page)).toContainText('Cannot create note "Briefing!" because briefing.md already exists')
    expect(fs.readFileSync(collidingPath, 'utf8')).toContain('# Weekly Sync')
  })
})
