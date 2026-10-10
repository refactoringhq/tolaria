import { expect, test, type Page } from '@playwright/test'
import fs from 'fs'
import os from 'os'
import path from 'path'
import { openFixtureVault, removeFixtureVaultCopy } from '../helpers/fixtureVault'

let vaultPath: string

test.beforeEach(() => {
  vaultPath = fs.mkdtempSync(path.join(os.tmpdir(), 'tolaria-sheet-reference-'))
  fs.writeFileSync(path.join(vaultPath, 'sheet.md'), '---\n_display: sheet\n---\n42\n')
  fs.writeFileSync(path.join(vaultPath, 'dashboard.md'), [
    '---',
    'status: Ready',
    '---',
    '# Dashboard',
    '',
    '```html',
    '<p>Status: {{status}}</p>',
    '<p>Answer: {{[[sheet]].A1}}</p>',
    '```',
    '',
  ].join('\n'))
})

test.afterEach(() => {
  removeFixtureVaultCopy(vaultPath)
})

async function selectNote(page: Page, title: string): Promise<void> {
  await page.locator('[data-testid="note-list-container"]').getByText(title, { exact: true }).click()
}

async function openDashboard(page: Page): Promise<void> {
  await openFixtureVault(page, vaultPath, { expectedReadyTitle: 'Dashboard' })
  await selectNote(page, 'Dashboard')
}

async function expectAnswer(page: Page, answer: string): Promise<void> {
  await expect(page.frameLocator('.html-block__frame').getByText(`Answer: ${answer}`, { exact: true })).toBeVisible()
  await expect(page.getByText('Tolaria render error', { exact: true })).toHaveCount(0)
}

test('opening a dashboard before its sheet resolves HTML cell references @smoke', async ({ page }) => {
  await openDashboard(page)
  await expectAnswer(page, '42')

  await selectNote(page, 'sheet')
  await expect(page.getByTestId('sheet-editor')).toBeVisible()
  await selectNote(page, 'Dashboard')
  await expectAnswer(page, '42')
})

test('HTML properties render while sheet expressions wait for WASM', async ({ page }) => {
  fs.writeFileSync(path.join(vaultPath, 'sheet.md'), '---\n_display: sheet\n---\n=21*2\n')
  let releaseWasm = () => {}
  const wasmGate = new Promise<void>((resolve) => { releaseWasm = resolve })
  await page.route('**/wasm_bg.wasm', async (route) => {
    await wasmGate
    await route.continue()
  })
  const wasmRequested = page.waitForRequest(/wasm_bg\.wasm$/u)

  try {
    await openDashboard(page)
    await wasmRequested
    await expect(page.frameLocator('.html-block__frame').getByText('Status: Ready', { exact: true })).toBeVisible()
    await expectAnswer(page, '{{[[sheet]].A1}}')

    releaseWasm()
    await expectAnswer(page, '42')
  } finally {
    releaseWasm()
  }
})

test('reopening a dashboard retries failed WASM initialization without crashing', async ({ page }) => {
  fs.writeFileSync(path.join(vaultPath, 'other.md'), '# Other\n')
  let wasmRequests = 0
  await page.route('**/wasm_bg.wasm', async (route) => {
    wasmRequests += 1
    if (wasmRequests === 1) {
      await route.abort('failed')
    } else {
      await route.continue()
    }
  })
  const initializationFailed = page.waitForEvent('console', {
    predicate: (message) => message.text().includes('[html-block] Failed to initialize sheet expressions:'),
  })

  await openDashboard(page)
  await initializationFailed
  await expectAnswer(page, '{{[[sheet]].A1}}')
  await selectNote(page, 'Other')
  await expect(page.locator('.bn-editor')).toContainText('Other')
  await selectNote(page, 'Dashboard')

  await expectAnswer(page, '42')
  expect(wasmRequests).toBe(2)
})
