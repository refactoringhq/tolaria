import { test, expect } from '@playwright/test'
import fs from 'fs'
import path from 'path'
import os from 'os'

const FIXTURE_VAULT = path.resolve('tests/fixtures/test-vault')

function copyDirSync(src: string, dest: string): void {
  fs.mkdirSync(dest, { recursive: true })
  for (const item of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, item.name)
    const d = path.join(dest, item.name)
    if (item.isDirectory()) copyDirSync(s, d)
    else fs.copyFileSync(s, d)
  }
}

let tempVaultDir: string

test.beforeEach(async ({ page }) => {
  tempVaultDir = fs.mkdtempSync(path.join(os.tmpdir(), 'laputa-test-vault-'))
  copyDirSync(FIXTURE_VAULT, tempVaultDir)

  await page.addInitScript((vaultPath: string) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let ref: any = null
    Object.defineProperty(window, '__mockHandlers', {
      set(val) {
        ref = val
        ref.load_vault_list = () => ({
          vaults: [{ label: 'Test Vault', path: vaultPath }],
          active_vault: vaultPath,
        })
        ref.check_vault_exists = () => true
        ref.get_last_vault_path = () => vaultPath
        ref.get_default_vault_path = () => vaultPath
        ref.save_vault_list = () => null
      },
      get() { return ref },
      configurable: true,
    })
  }, tempVaultDir)

  await page.goto('/')
  await page.getByText('Alpha Project', { exact: true }).first().waitFor({ timeout: 10_000 })
})

test.afterEach(async () => {
  fs.rmSync(tempVaultDir, { recursive: true, force: true })
})

test('creating an untitled draft hides the legacy title section in the editor', async ({ page }) => {
  await page.locator('button[title="Create new note"]').click()

  await expect(page.getByRole('textbox').last()).toBeVisible({ timeout: 5_000 })
  await expect(page.getByTestId('title-field-input')).toHaveCount(0)
  await expect(page.locator('.title-section[data-title-ui-visible]')).toHaveCount(0)
})
