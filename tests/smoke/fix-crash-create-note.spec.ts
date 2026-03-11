import { test, expect } from '@playwright/test'
import { sendShortcut } from './helpers'

test.describe('Create note crash fix', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')
  })

  test('clicking + next to a type section creates a note without crashing', async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', (err) => errors.push(err.message))

    // Hover over the Projects section to reveal the + button
    const sectionHeader = page.getByText('Projects').first()
    await sectionHeader.hover()

    // Click the actual create button (exact match avoids the parent sortable div)
    const createBtn = page.getByRole('button', { name: 'Create new Project', exact: true })
    await createBtn.click({ force: true })

    // The new note should appear — check for tab + heading
    await expect(page.getByText('Untitled project').first()).toBeVisible({ timeout: 3000 })

    expect(errors).toEqual([])
  })

  test('Cmd+N creates a note without crashing', async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', (err) => errors.push(err.message))

    await page.locator('body').click()
    await sendShortcut(page, 'n', ['Control'])

    await page.waitForTimeout(500)

    // An "Untitled note" tab should be visible
    await expect(page.getByText(/Untitled note/).first()).toBeVisible({ timeout: 3000 })

    expect(errors).toEqual([])
  })

  test('creating note for custom type does not crash', async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', (err) => errors.push(err.message))

    // Hover over a custom type section (Areas exists in mock vault)
    const sectionHeader = page.getByText('Areas').first()
    await sectionHeader.hover()

    const createBtn = page.getByRole('button', { name: 'Create new Area', exact: true })
    await createBtn.click({ force: true })

    await expect(page.getByText('Untitled area').first()).toBeVisible({ timeout: 3000 })

    expect(errors).toEqual([])
  })

  test('rapid note creation does not crash', async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', (err) => errors.push(err.message))

    const sectionHeader = page.getByText('Experiments').first()
    await sectionHeader.hover()

    const createBtn = page.getByRole('button', { name: 'Create new Experiment', exact: true })
    await createBtn.click({ force: true })
    await createBtn.click({ force: true })

    await page.waitForTimeout(500)

    // At least one untitled experiment should exist
    await expect(page.getByText('Untitled experiment').first()).toBeVisible({ timeout: 3000 })

    expect(errors).toEqual([])
  })
})
