import { expect, type Page, test } from '@playwright/test'


/** Click the first non-Theme note with a visible type selector, starting from startIndex. */
async function clickNonThemeNote(page: Page, startIndex = 0) {
  const noteListContainer = page.locator('[data-testid="note-list-container"]')
  await noteListContainer.waitFor({ timeout: 5000 })
  const items = noteListContainer.locator('.cursor-pointer')
  const count = await items.count()

  for (let i = startIndex; i < Math.min(count, startIndex + 15); i++) {
    await items.nth(i).click()
    await page.waitForTimeout(500)
    const typeSelector = page.locator('[data-testid="type-selector"]')
    if (!(await typeSelector.isVisible())) continue
    const trigger = typeSelector.locator('button[role="combobox"]')
    const type = (await trigger.textContent())?.trim() ?? ''
    if (type !== 'Theme') return type
  }
  return ''
}

test.describe('Changing note type preserves content', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1600, height: 900 })
    await page.goto('/')
    await page.waitForLoadState('networkidle')
  })

  test('type change does not load a different note into the editor', async ({ page }) => {
    const currentType = await clickNonThemeNote(page)
    test.skip(!currentType, 'No non-Theme note found with visible type selector')

    const editorContainer = page.locator('.bn-editor')
    await expect(editorContainer).toBeVisible({ timeout: 5000 })
    // Wait for editor content to stabilise after note selection
    await page.waitForTimeout(800)
    const headingBefore = await editorContainer.locator('h1').first().textContent()
    expect(headingBefore).toBeTruthy()

    const typeSelector = page.locator('[data-testid="type-selector"]')
    const selectTrigger = typeSelector.locator('button[role="combobox"]')

    const targetType = currentType === 'Project' ? 'Experiment' : 'Project'
    await selectTrigger.click()
    const option = page.getByRole('option', { name: targetType, exact: true }).first()
    await expect(option).toBeVisible({ timeout: 3000 })
    await option.click()

    // Wait for type change to propagate through state
    await page.waitForTimeout(1500)

    // CRITICAL: verify the editor still shows the SAME note's heading
    const headingAfter = await editorContainer.locator('h1').first().textContent()
    expect(headingAfter).toBe(headingBefore)

    // Restore original type
    await selectTrigger.click()
    await page.waitForTimeout(500)
    const restoreOption = page.getByRole('option', { name: currentType, exact: true })
    if (await restoreOption.isVisible()) {
      await restoreOption.click()
      await page.waitForTimeout(1000)
    } else {
      await page.keyboard.press('Escape')
    }
  })
})
