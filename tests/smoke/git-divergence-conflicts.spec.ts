import { test, expect } from '@playwright/test'
import { openCommandPalette, executeCommand } from './helpers'

test.describe('Git divergence, conflicts, and manual pull', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')
  })

  test('push rejection sets pull_required status in bottom bar', async ({ page }) => {
    // Override git_push mock to return rejected
    await page.evaluate(() => {
      window.__mockHandlers!.git_push = () => ({
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

    // Verify "Pull required" label appears in the status bar
    const syncBadge = page.getByTestId('status-sync')
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

  test('git status popup shows branch and sync info when clicking sync badge', async ({ page }) => {
    // Override git_remote_status to return data with ahead/behind
    await page.evaluate(() => {
      window.__mockHandlers!.git_remote_status = () => ({
        branch: 'main',
        ahead: 3,
        behind: 1,
        hasRemote: true,
      })
    })

    // Trigger a sync so the remote status gets fetched
    const syncBadge = page.getByTestId('status-sync')
    await syncBadge.click()

    // The popup should appear
    const popup = page.getByTestId('git-status-popup')
    await expect(popup).toBeVisible({ timeout: 3000 })
    await expect(popup).toContainText('main')
  })

  test('conflict badge shows count when conflicts exist', async ({ page }) => {
    // Override git_pull to return conflicts
    await page.evaluate(() => {
      window.__mockHandlers!.git_pull = () => ({
        status: 'conflict',
        message: 'Merge conflict in 2 file(s)',
        updatedFiles: [],
        conflictFiles: ['note-a.md', 'note-b.md'],
      })
      window.__mockHandlers!.get_conflict_files = () => ['note-a.md', 'note-b.md']
    })

    // Trigger a sync
    await openCommandPalette(page)
    await executeCommand(page, 'Pull from Remote')

    // Verify conflict count badge appears
    const conflictBadge = page.getByTestId('status-conflict-count')
    await expect(conflictBadge).toBeVisible({ timeout: 5000 })
    await expect(conflictBadge).toContainText('2 conflicts')
  })
})
