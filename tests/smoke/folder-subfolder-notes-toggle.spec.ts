import fs from 'node:fs'
import path from 'node:path'
import { test, expect, type Page } from '@playwright/test'
import {
  createFixtureVaultCopy,
  openFixtureVaultDesktopHarness,
  removeFixtureVaultCopy,
} from '../helpers/fixtureVault'

let tempVaultDir: string

function writeNote(relativePath: string, title: string): void {
  const filePath = path.join(tempVaultDir, relativePath)
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
  fs.writeFileSync(filePath, `---\ntype: Note\n---\n\n# ${title}\n`)
}

function noteRow(page: Page, relativePath: string) {
  return page.locator(`[data-note-path="${path.join(tempVaultDir, relativePath)}"]`)
}

async function storedFoldersConfig(page: Page): Promise<unknown> {
  return page.evaluate((vaultPath) => {
    const raw = localStorage.getItem(`laputa:vault-config:${vaultPath}`)
    return raw ? JSON.parse(raw).folders ?? null : null
  }, tempVaultDir)
}

test.beforeEach(async ({ page }) => {
  tempVaultDir = createFixtureVaultCopy()
  writeNote('project/sub/nested-plan.md', 'Nested Plan')
  await openFixtureVaultDesktopHarness(page, tempVaultDir, {
    folders: [{
      name: 'project',
      path: 'project',
      children: [{ children: [], name: 'sub', path: 'project/sub' }],
    }],
  })
  await expect(page.getByTestId('folder-row:project')).toBeVisible({ timeout: 5_000 })
})

test.afterEach(() => {
  removeFixtureVaultCopy(tempVaultDir)
})

test('folder view can hide and restore notes from subfolders', async ({ page }) => {
  await page.getByTestId('folder-row:project').click()

  const toggle = page.getByRole('button', { name: 'Show subfolder notes' })
  await expect(toggle).toHaveAttribute('aria-pressed', 'true')
  await expect(noteRow(page, 'project/alpha-project.md')).toBeVisible()
  await expect(noteRow(page, 'project/sub/nested-plan.md')).toBeVisible()

  await toggle.click()

  await expect(toggle).toHaveAttribute('aria-pressed', 'false')
  await expect(noteRow(page, 'project/alpha-project.md')).toBeVisible()
  await expect(noteRow(page, 'project/sub/nested-plan.md')).toHaveCount(0)
  await expect.poll(() => storedFoldersConfig(page)).toEqual({ includeSubfolders: false })

  await page.getByTestId('folder-row:project/sub').click()
  await expect(noteRow(page, 'project/sub/nested-plan.md')).toBeVisible()

  await page.getByTestId('folder-row:project').click()
  await expect(noteRow(page, 'project/sub/nested-plan.md')).toHaveCount(0)
  await toggle.click()
  await expect(noteRow(page, 'project/sub/nested-plan.md')).toBeVisible()
  await expect.poll(() => storedFoldersConfig(page)).toEqual({ includeSubfolders: true })
})
