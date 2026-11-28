import { test, expect } from '@playwright/test'
import { openCommandPalette, executeCommand } from './helpers'

test.describe('Git divergence, conflicts, and manual pull', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')
  })

  test('push rejection shows Pull required on the sidebar sync pill', async ({ page }) => {
    // Override git_push mock to return rejected
    await page.evaluate(() => {
      const handlers = window.__mockHandlers
      if (!handlers) throw new Error('Git mocks were not installed')
      handlers.git_push = () => ({
        status: 'rejected',
        message: 'Push rejected: remote has new commits. Pull first, then push.',
      })
    })

    // Commit to trigger push
    await openCommandPalette(page)
    await executeCommand(page, 'Commit & Push')

    const textarea = page.locator('textarea[placeholder="Commit message..."]')
    await textarea.waitFor({ timeout: 5000 })
    await textarea.fill('test commit')
    await page.getByRole('button', { name: 'Commit & Push' }).click()

    // Verify toast shows rejection message
    const toast = page.locator('.fixed.bottom-8')
    await expect(toast).toContainText('push rejected', { timeout: 5000 })

    // Verify the sync pill exposes the pull-required state.
    const syncBadge = page.getByTestId('sidebar-sync')
    await expect(syncBadge).toContainText('Pull required', { timeout: 5000 })
  })

  test('Pull from Remote command exists in command palette', async ({ page }) => {
    await openCommandPalette(page)

    const input = page.locator('input[placeholder="Type a command..."]')
    await input.fill('Pull')

    // Verify the Pull from Remote command appears as the selected item
    const match = page.locator('[data-selected="true"]').first()
    await expect(match).toContainText('Pull from Remote', { timeout: 3000 })
  })

  test('the sidebar sync menu opens vault history', async ({ page }) => {
    await page.getByTestId('sidebar-sync').click()
    const menu = page.getByTestId('sidebar-sync-menu')
    await expect(menu.getByRole('menuitem', { name: 'View changes' })).toBeVisible()
    await expect(menu.getByRole('menuitem', { name: /Sync now/ })).toBeVisible()

    await menu.getByRole('menuitem', { name: 'View history' }).click()
    await expect(page.getByTestId('pulse-header')).toBeVisible()
  })

  test('failed sync offers conflict management alongside retry @smoke', async ({ page }) => {
    await page.evaluate(() => {
      const handlers = window.__mockHandlers
      if (!handlers) throw new Error('Git mocks were not installed')
      handlers.git_pull = () => ({
        status: 'error',
        message: 'Pull failed',
        updatedFiles: [],
        conflictFiles: [],
      })
      handlers.get_conflict_files = () => []
    })

    const sync = page.getByTestId('sidebar-sync')
    await sync.click()
    await page.getByRole('menuitem', { name: /Sync now/ }).click()
    await expect(sync).toContainText('Sync failed')

    await page.evaluate(() => {
      const handlers = window.__mockHandlers
      if (!handlers) throw new Error('Git mocks were not installed')
      handlers.get_conflict_files = () => ['note-a.md']
    })

    await sync.click()
    await expect(page.getByRole('menuitem', { name: /Sync now/ })).toBeEnabled()
    await page.getByRole('menuitem', { name: 'Resolve merge conflicts' }).click()
    await expect(page.getByTestId('conflict-file-note-a.md')).toBeVisible()
  })

  test('conflict badge shows count when conflicts exist', async ({ page }) => {
    // Override git_pull to return conflicts
    await page.evaluate(() => {
      const handlers = window.__mockHandlers
      if (!handlers) throw new Error('Git mocks were not installed')
      handlers.git_pull = () => ({
        status: 'conflict',
        message: 'Merge conflict in 2 file(s)',
        updatedFiles: [],
        conflictFiles: ['note-a.md', 'note-b.md'],
      })
      handlers.get_conflict_files = () => ['note-a.md', 'note-b.md']
    })

    // Trigger a sync
    await openCommandPalette(page)
    await executeCommand(page, 'Pull from Remote')

    const syncPill = page.getByTestId('sidebar-sync')
    await expect(syncPill).toContainText('2 conflicts')
    await syncPill.click()
    await expect(page.getByRole('menuitem', { name: /Resolve merge conflicts/ })).toBeEnabled()
  })
})
