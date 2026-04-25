import { test, expect, type Page } from '@playwright/test'
import * as path from 'path'
import * as fs from 'fs'
import {
  createFixtureVaultCopy,
  openFixtureVault,
  removeFixtureVaultCopy,
} from '../tests/helpers/fixtureVault'

// Minimal valid PNG: 1x1 red pixel
const TEST_PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg=='

function createTestPng(filepath: string) {
  fs.mkdirSync(path.dirname(filepath), { recursive: true })
  fs.writeFileSync(filepath, Buffer.from(TEST_PNG_BASE64, 'base64'))
}

let tempVaultDir: string

async function openImageTestNote(page: Page) {
  await page.locator('[data-testid="note-list-container"]').getByText('Alpha Project', { exact: true }).click()

  const editor = page.locator('.bn-editor')
  await expect(editor).toBeVisible({ timeout: 10000 })
  return editor
}

test.beforeEach(async ({ page }, testInfo) => {
  testInfo.setTimeout(60_000)
  tempVaultDir = createFixtureVaultCopy()
  await openFixtureVault(page, tempVaultDir)
})

test.afterEach(async () => {
  removeFixtureVaultCopy(tempVaultDir)
})

test('image upload via file picker displays image with data URL', async ({ page }) => {
  const editor = await openImageTestNote(page)
  await editor.click()
  await page.waitForTimeout(200)

  // Insert image block via slash command
  await page.keyboard.press('Enter')
  await page.waitForTimeout(100)
  await page.keyboard.type('/image', { delay: 80 })
  await page.waitForTimeout(500)

  // Select Image from slash menu (press Enter to pick first match)
  await page.keyboard.press('Enter')
  await page.waitForTimeout(500)

  // Verify Upload tab is available (uploadFile is configured)
  const fileInput = page.locator('input[type="file"]')
  expect(await fileInput.count()).toBeGreaterThan(0)

  // Upload a test image
  const testImagePath = path.join(process.cwd(), 'test-results', 'test-image.png')
  createTestPng(testImagePath)

  await fileInput.first().setInputFiles(testImagePath)
  await page.waitForTimeout(2000)

  // Verify: image element exists in the editor
  const images = page.locator('.bn-editor img')
  const imageCount = await images.count()
  expect(imageCount).toBeGreaterThan(0)

  // Verify: image uses data URL (stable, survives reload in dev mode)
  const src = await images.first().getAttribute('src')
  expect(src).toMatch(/^data:/)

  // Verify: no "Loading..." elements remain
  const loadingEls = page.locator('.bn-file-loading-preview')
  expect(await loadingEls.count()).toBe(0)

  await page.screenshot({ path: 'test-results/image-upload-after.png', fullPage: true })

  if (fs.existsSync(testImagePath)) fs.unlinkSync(testImagePath)
})

test('image paste into editor inserts image block', async ({ page }) => {
  const editor = await openImageTestNote(page)
  await editor.click()

  await page.evaluate((base64) => {
    const editorElement = document.querySelector('.bn-editor')
    if (!editorElement) throw new Error('Editor not found')

    const binary = atob(base64)
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)

    const file = new File([bytes], 'pasted-image.png', { type: 'image/png' })
    const clipboardData = new DataTransfer()
    clipboardData.items.add(file)
    editorElement.dispatchEvent(new ClipboardEvent('paste', {
      clipboardData,
      bubbles: true,
      cancelable: true,
    }))
  }, TEST_PNG_BASE64)

  const images = page.locator('.bn-editor img')
  await expect(images.first()).toBeVisible({ timeout: 5000 })

  const src = await images.first().getAttribute('src')
  expect(src).toMatch(/^data:/)
})

test('editor has uploadFile configured (no error on image block insert)', async ({ page }) => {
  const editor = await openImageTestNote(page)

  // Capture console errors
  const errors: string[] = []
  page.on('pageerror', (err) => errors.push(err.message))

  // Insert an image block via slash command
  await editor.click()
  await page.keyboard.press('Enter')
  await page.keyboard.type('/image', { delay: 30 })
  await page.waitForTimeout(500)

  // Press Enter to select Image
  await page.keyboard.press('Enter')
  await page.waitForTimeout(500)

  await page.screenshot({ path: 'test-results/image-block-inserted.png', fullPage: true })

  // No errors related to upload should have occurred
  const uploadErrors = errors.filter(e => e.includes('upload'))
  expect(uploadErrors).toHaveLength(0)
})
