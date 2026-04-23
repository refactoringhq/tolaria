import fs from 'fs'
import path from 'path'
import { test, expect, type Page } from '@playwright/test'
import {
  createFixtureVaultCopy,
  openFixtureVaultDesktopHarness,
  removeFixtureVaultCopy,
} from '../helpers/fixtureVault'
import { executeCommand, openCommandPalette } from './helpers'

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

function notePath(vaultPath: string): string {
  return path.join(vaultPath, 'note', 'note-b.md')
}

function writeChecklistNote(vaultPath: string, marker: string, checked = false): void {
  const checkbox = checked ? 'x' : ' '

  fs.writeFileSync(notePath(vaultPath), `---
Is A: Note
Status: Active
---

# Note B

- [${checkbox}] Toggle me
- [ ] Keep me

${marker}
`, 'utf8')
}

async function openNote(page: Page, title: string) {
  await page.getByTestId('note-list-container').getByText(title, { exact: true }).click()
  await expect(page.locator('.bn-editor')).toBeVisible({ timeout: 5_000 })
}

async function pullFromRemote(page: Page) {
  await openCommandPalette(page)
  await executeCommand(page, 'Pull from Remote')
}

async function stubUpdatedPull(page: Page, updatedFile: string) {
  await page.evaluate((filePath) => {
    window.__mockHandlers!.git_pull = () => ({
      status: 'updated',
      message: 'Pulled 1 update from remote',
      updatedFiles: [filePath],
      conflictFiles: [],
    })
  }, updatedFile)
}

function checklistCheckbox(page: Page, index: number) {
  return page.locator('.bn-block-content[data-content-type="checkListItem"] input[type="checkbox"]').nth(index)
}

test.describe('checklist pull refresh regression', () => {
  test.beforeEach(({ page }, testInfo) => {
    void page
    testInfo.setTimeout(60_000)
    tempVaultDir = createFixtureVaultCopy()
    writeChecklistNote(tempVaultDir, 'Initial checklist body.')
  })

  test.afterEach(() => {
    removeFixtureVaultCopy(tempVaultDir)
  })

  test('pull does not replace an unsaved checklist note in place', async ({ page }) => {
    const errors = trackUnexpectedErrors(page)
    const pulledMarker = `Pulled checklist refresh ${Date.now()}`
    const filePath = notePath(tempVaultDir)

    await openFixtureVaultDesktopHarness(page, tempVaultDir)
    await openNote(page, 'Note B')

    const firstCheckbox = checklistCheckbox(page, 0)
    await expect(firstCheckbox).toBeVisible({ timeout: 5_000 })
    await expect(firstCheckbox).not.toBeChecked()

    await firstCheckbox.click()
    await expect(firstCheckbox).toBeChecked()

    writeChecklistNote(tempVaultDir, pulledMarker, true)
    await stubUpdatedPull(page, filePath)
    await pullFromRemote(page)

    await expect(page.getByText('Pulled 1 update(s) from remote')).toBeVisible({ timeout: 5_000 })
    await expect(page.locator('.bn-editor')).not.toContainText(pulledMarker)
    await expect(page.locator('.bn-editor')).toContainText('Initial checklist body.')
    await expect(checklistCheckbox(page, 0)).toBeChecked()

    await openNote(page, 'Note C')
    await openNote(page, 'Note B')
    await expect(page.locator('.bn-editor')).not.toContainText(pulledMarker)
    await expect(page.locator('.bn-editor')).toContainText('Initial checklist body.')
    await expect(checklistCheckbox(page, 0)).toBeChecked()

    expect(errors).toEqual([])
  })
})
