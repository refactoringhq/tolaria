import { test, expect } from '@playwright/test'
import * as path from 'path'
import * as fs from 'fs'

// Minimal valid PNG: 1x1 red pixel
const TEST_PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg=='

function createTestImage(filepath: string) {
  fs.mkdirSync(path.dirname(filepath), { recursive: true })
  fs.writeFileSync(filepath, Buffer.from(TEST_PNG_BASE64, 'base64'))
}

test('drag & drop image into editor inserts image block', async ({ page }) => {
  await page.goto('/')
  await page.waitForTimeout(1000)

  // Open a note
  await page.locator('[data-testid="type-icon"]').first().click({ timeout: 10000 })
  await page.waitForTimeout(500)

  const editor = page.locator('.bn-editor')
  await expect(editor).toBeVisible({ timeout: 10000 })
  await editor.click()
  await page.waitForTimeout(200)

  // Create a test image file
  const testImagePath = path.join(process.cwd(), 'test-results', 'drag-test-image.png')
  createTestImage(testImagePath)

  // Screenshot before
  await page.screenshot({ path: 'test-results/drag-drop-before.png', fullPage: true })

  // Simulate drag-and-drop of a file into the editor
  // Playwright supports dispatching drag events with DataTransfer
  const editorContainer = page.locator('.editor__blocknote-container')
  const box = await editorContainer.boundingBox()
  expect(box).toBeTruthy()

  // Use Playwright's page.dispatchEvent with a custom script to simulate file drop
  await page.evaluate(async ({ base64, x, y }) => {
    const container = document.querySelector('.editor__blocknote-container')
    if (!container) throw new Error('Editor container not found')

    // Convert base64 to Uint8Array
    const binary = atob(base64)
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)

    // Create a File object
    const file = new File([bytes], 'drag-test-image.png', { type: 'image/png' })

    // Create DataTransfer with the file
    const dt = new DataTransfer()
    dt.items.add(file)

    // Dispatch dragover first (to set the drop effect)
    const dragOverEvent = new DragEvent('dragover', {
      dataTransfer: dt,
      bubbles: true,
      cancelable: true,
      clientX: x,
      clientY: y,
    })
    container.dispatchEvent(dragOverEvent)

    // Then dispatch drop
    const dropEvent = new DragEvent('drop', {
      dataTransfer: dt,
      bubbles: true,
      cancelable: true,
      clientX: x,
      clientY: y,
    })
    container.dispatchEvent(dropEvent)
  }, {
    base64: TEST_PNG_BASE64,
    x: box!.x + box!.width / 2,
    y: box!.y + box!.height / 2,
  })

  // Wait for the image to be uploaded and inserted
  await page.waitForTimeout(2000)

  // Verify: image element exists in the editor
  const images = page.locator('.bn-editor img')
  await expect(images.first()).toBeVisible({ timeout: 5000 })

  // Verify: image uses data URL (browser mode)
  const src = await images.first().getAttribute('src')
  expect(src).toMatch(/^data:/)

  await page.screenshot({ path: 'test-results/drag-drop-after.png', fullPage: true })

  // Clean up
  if (fs.existsSync(testImagePath)) fs.unlinkSync(testImagePath)
})

test('drop zone overlay appears during image drag', async ({ page }) => {
  await page.goto('/')
  await page.waitForTimeout(1000)

  // Open a note
  await page.locator('[data-testid="type-icon"]').first().click({ timeout: 10000 })
  await page.waitForTimeout(500)

  const editor = page.locator('.bn-editor')
  await expect(editor).toBeVisible({ timeout: 10000 })

  const editorContainer = page.locator('.editor__blocknote-container')
  const box = await editorContainer.boundingBox()
  expect(box).toBeTruthy()

  // Simulate dragover with an image file to trigger overlay
  await page.evaluate(({ x, y }) => {
    const container = document.querySelector('.editor__blocknote-container')
    if (!container) throw new Error('Editor container not found')

    const file = new File([new Uint8Array(1)], 'test.png', { type: 'image/png' })
    const dt = new DataTransfer()
    dt.items.add(file)

    const event = new DragEvent('dragover', {
      dataTransfer: dt,
      bubbles: true,
      cancelable: true,
      clientX: x,
      clientY: y,
    })
    container.dispatchEvent(event)
  }, { x: box!.x + box!.width / 2, y: box!.y + box!.height / 2 })

  // The drop overlay should be visible
  const overlay = page.locator('.editor__drop-overlay')
  await expect(overlay).toBeVisible({ timeout: 2000 })
  await expect(overlay).toContainText('Drop image here')

  await page.screenshot({ path: 'test-results/drag-drop-overlay.png', fullPage: true })
})

test('non-image file drop is ignored', async ({ page }) => {
  await page.goto('/')
  await page.waitForTimeout(1000)

  // Open a note
  await page.locator('[data-testid="type-icon"]').first().click({ timeout: 10000 })
  await page.waitForTimeout(500)

  const editor = page.locator('.bn-editor')
  await expect(editor).toBeVisible({ timeout: 10000 })

  const editorContainer = page.locator('.editor__blocknote-container')
  const box = await editorContainer.boundingBox()
  expect(box).toBeTruthy()

  // Count images before
  const imagesBefore = await page.locator('.bn-editor img').count()

  // Simulate dropping a text file
  await page.evaluate(({ x, y }) => {
    const container = document.querySelector('.editor__blocknote-container')
    if (!container) throw new Error('Editor container not found')

    const file = new File(['not an image'], 'readme.txt', { type: 'text/plain' })
    const dt = new DataTransfer()
    dt.items.add(file)

    container.dispatchEvent(new DragEvent('drop', {
      dataTransfer: dt,
      bubbles: true,
      cancelable: true,
      clientX: x,
      clientY: y,
    }))
  }, { x: box!.x + box!.width / 2, y: box!.y + box!.height / 2 })

  await page.waitForTimeout(500)

  // No new images should have been added
  const imagesAfter = await page.locator('.bn-editor img').count()
  expect(imagesAfter).toBe(imagesBefore)
})
