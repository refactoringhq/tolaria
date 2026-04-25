import { test, expect, type Page } from '@playwright/test'
import {
  createFixtureVaultCopy,
  openFixtureVaultDesktopHarness,
  removeFixtureVaultCopy,
} from '../helpers/fixtureVault'
import { dispatchShortcutEvent } from './testBridge'

const USE_META_SHORTCUTS = process.platform === 'darwin'

let tempVaultDir: string

async function focusNoteList(page: Page) {
  const container = page.getByTestId('note-list-container')
  await container.focus()
  await expect(container).toBeFocused()
}

async function dispatchCommandShortcut(page: Page, key: string, code: string) {
  await dispatchShortcutEvent(page, {
    key,
    code,
    metaKey: USE_META_SHORTCUTS,
    ctrlKey: !USE_META_SHORTCUTS,
    shiftKey: false,
    altKey: false,
    bubbles: true,
    cancelable: true,
  })
}

async function selectVisibleInboxBatch(page: Page) {
  await focusNoteList(page)
  await dispatchCommandShortcut(page, 'a', 'KeyA')
  await expect(page.getByTestId('bulk-action-bar')).toBeVisible({ timeout: 5_000 })
}

test.describe('multi-selection shortcuts', () => {
  test.beforeEach(() => {
    tempVaultDir = createFixtureVaultCopy()
  })

  test.afterEach(() => {
    removeFixtureVaultCopy(tempVaultDir)
  })

  test('Cmd/Ctrl+E organizes the full Inbox multi-selection @smoke', async ({ page }) => {
    await openFixtureVaultDesktopHarness(page, tempVaultDir)
    await selectVisibleInboxBatch(page)

    await dispatchCommandShortcut(page, 'e', 'KeyE')

    await expect(page.getByTestId('bulk-action-bar')).toHaveCount(0)
    await expect(page.getByText('All notes are organized')).toBeVisible({ timeout: 5_000 })
  })

  test('Cmd/Ctrl+Backspace batch-deletes the full visible multi-selection after one confirmation @smoke', async ({ page }) => {
    await openFixtureVaultDesktopHarness(page, tempVaultDir)
    await selectVisibleInboxBatch(page)

    await dispatchCommandShortcut(page, 'Backspace', 'Backspace')

    const dialog = page.getByTestId('confirm-delete-dialog')
    const confirmButton = page.getByTestId('confirm-delete-btn')
    await expect(dialog).toBeVisible({ timeout: 5_000 })
    await expect(dialog).toContainText(/Delete \d+ notes permanently\?/)

    await expect(confirmButton).toBeFocused()
    await page.keyboard.press('Enter')

    await expect(dialog).toHaveCount(0)
    await expect(page.getByTestId('bulk-action-bar')).toHaveCount(0)
  })
})
