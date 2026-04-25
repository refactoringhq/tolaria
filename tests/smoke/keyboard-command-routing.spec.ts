import { test, expect, type Page } from '@playwright/test'
import { APP_COMMAND_IDS } from '../../src/hooks/appCommandCatalog'
import {
  dispatchShortcutEvent,
  triggerMenuCommand,
  triggerShortcutCommand,
} from './testBridge'
import {
  createFixtureVaultCopy,
  openFixtureVaultDesktopHarness,
  removeFixtureVaultCopy,
} from '../helpers/fixtureVault'

let tempVaultDir: string

async function openAlphaProjectInEditor(page: Page) {
  await openFixtureVaultDesktopHarness(page, tempVaultDir)
  await page.getByText('Alpha Project', { exact: true }).first().click()
  await page.locator('.bn-editor').click()
}

async function expectPropertiesPanelToggle(page: Page, toggle: () => Promise<void>) {
  const propertiesButton = page.getByRole('button', { name: 'Open the properties panel' })
  await expect(propertiesButton).toBeVisible({ timeout: 5_000 })

  await toggle()
  await expect(propertiesButton).toHaveCount(0)

  await toggle()
  await expect(page.getByRole('button', { name: 'Open the properties panel' })).toBeVisible({ timeout: 5_000 })
}

test.describe('keyboard command routing', () => {
  test.beforeEach(() => {
    tempVaultDir = createFixtureVaultCopy()
  })

  test.afterEach(() => {
    removeFixtureVaultCopy(tempVaultDir)
  })

  test('desktop menu-command bridge creates a note through the shared command path @smoke', async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', (error) => errors.push(error.message))

    await openFixtureVaultDesktopHarness(page, tempVaultDir)
    await triggerMenuCommand(page, APP_COMMAND_IDS.fileNewNote)

    await expect(page.getByTestId('breadcrumb-filename-trigger')).toContainText(/untitled-note-\d+/i, { timeout: 5_000 })
    expect(errors).toEqual([])
  })

  test('desktop menu-command bridge toggles the properties panel through the shared command path @smoke', async ({ page }) => {
    await openAlphaProjectInEditor(page)
    await expectPropertiesPanelToggle(page, async () => {
      await triggerMenuCommand(page, APP_COMMAND_IDS.viewToggleProperties)
    })
  })

  test('desktop keyboard shortcut toggles the properties panel through the renderer shortcut path @smoke', async ({ page }) => {
    await openAlphaProjectInEditor(page)
    await expectPropertiesPanelToggle(page, async () => {
      await page.keyboard.press(process.platform === 'darwin' ? 'Meta+Shift+I' : 'Control+Shift+I')
    })
  })

  test('desktop shortcut bridge opens quick open through both Cmd+P and Cmd+O @smoke', async ({ page }) => {
    await openFixtureVaultDesktopHarness(page, tempVaultDir)

    await dispatchShortcutEvent(page, {
      key: 'p',
      code: 'KeyP',
      ctrlKey: false,
      metaKey: true,
      shiftKey: false,
      altKey: false,
      bubbles: true,
      cancelable: true,
    })
    await expect(page.getByTestId('quick-open-palette')).toBeVisible({ timeout: 5_000 })
    await expect(page.locator('input[placeholder="Search notes..."]')).toBeFocused()

    await page.keyboard.press('Escape')
    await expect(page.getByTestId('quick-open-palette')).not.toBeVisible({ timeout: 5_000 })

    await dispatchShortcutEvent(page, {
      key: 'o',
      code: 'KeyO',
      ctrlKey: false,
      metaKey: true,
      shiftKey: false,
      altKey: false,
      bubbles: true,
      cancelable: true,
    })
    await expect(page.getByTestId('quick-open-palette')).toBeVisible({ timeout: 5_000 })
    await expect(page.locator('input[placeholder="Search notes..."]')).toBeFocused()
  })

  test('desktop menu-command bridge toggles organized state through the shared command path @smoke', async ({ page }) => {
    await openAlphaProjectInEditor(page)

    await expect(page.getByRole('button', { name: 'Set note as organized' })).toBeVisible({ timeout: 5_000 })

    await triggerMenuCommand(page, APP_COMMAND_IDS.noteToggleOrganized)
    await expect(page.getByRole('button', { name: 'Set note as not organized' })).toBeVisible({ timeout: 5_000 })

    await triggerMenuCommand(page, APP_COMMAND_IDS.noteToggleOrganized)
    await expect(page.getByRole('button', { name: 'Set note as organized' })).toBeVisible({ timeout: 5_000 })
  })

  test('renderer shortcut bridge toggles the raw editor through the shared keyboard handler @smoke', async ({ page }) => {
    await openAlphaProjectInEditor(page)

    await triggerShortcutCommand(page, APP_COMMAND_IDS.editToggleRawEditor)
    await expect(page.getByTestId('raw-editor-codemirror')).toBeVisible({ timeout: 5_000 })

    await triggerShortcutCommand(page, APP_COMMAND_IDS.editToggleRawEditor)
    await expect(page.getByTestId('raw-editor-codemirror')).not.toBeVisible({ timeout: 5_000 })
    await expect(page.locator('.bn-editor')).toBeVisible({ timeout: 5_000 })
  })

  test('desktop menu-command bridge toggles the AI panel, while the wrong modifier event does not @smoke', async ({ page }) => {
    await openAlphaProjectInEditor(page)

    await dispatchShortcutEvent(page, {
      key: 'l',
      code: 'KeyL',
      ctrlKey: false,
      metaKey: false,
      shiftKey: true,
      altKey: true,
      bubbles: true,
      cancelable: true,
    })
    await page.waitForTimeout(200)
    await expect(page.getByTestId('ai-panel')).not.toBeVisible()

    await triggerMenuCommand(page, APP_COMMAND_IDS.viewToggleAiChat)
    await expect(page.getByTestId('ai-panel')).toBeVisible({ timeout: 5_000 })
    await expect(page.getByTitle('Close AI panel')).toBeVisible()

    await triggerMenuCommand(page, APP_COMMAND_IDS.viewToggleAiChat)
    await expect(page.getByTestId('ai-panel')).not.toBeVisible({ timeout: 5_000 })
  })
})
