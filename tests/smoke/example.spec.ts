import { test, expect } from '@playwright/test'
import {
  openCommandPalette,
  closeCommandPalette,
  findCommand,
  sendShortcut,
  verifyVisible,
} from './helpers'

test.describe('Command Palette smoke tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')
  })

  test('Cmd+K opens the command palette', async ({ page }) => {
    await openCommandPalette(page)
    await verifyVisible(page, 'input[placeholder="Type a command..."]')
  })

  test('Escape closes the command palette', async ({ page }) => {
    await openCommandPalette(page)
    await closeCommandPalette(page)
    await expect(
      page.locator('input[placeholder="Type a command..."]'),
    ).not.toBeVisible()
  })

  test('typing filters the command list', async ({ page }) => {
    await openCommandPalette(page)
    const found = await findCommand(page, 'reindex')
    expect(found).toBe(true)
  })

  test('arrow keys navigate commands', async ({ page }) => {
    await openCommandPalette(page)
    const first = await page
      .locator('[data-selected="true"]')
      .first()
      .textContent()
    await page.keyboard.press('ArrowDown')
    const second = await page
      .locator('[data-selected="true"]')
      .first()
      .textContent()
    expect(first).not.toBe(second)
  })
})

test.describe('Keyboard shortcuts smoke tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')
  })

  test('Cmd+P opens quick open palette', async ({ page }) => {
    await page.locator('body').click()
    await sendShortcut(page, 'p', ['Control'])
    await expect(
      page.locator('input[placeholder="Search notes..."]'),
    ).toBeVisible()
  })

  test('Escape closes command palette after Cmd+K', async ({ page }) => {
    await openCommandPalette(page)
    await page.keyboard.press('Escape')
    await expect(
      page.locator('input[placeholder="Type a command..."]'),
    ).not.toBeVisible()
  })
})
