import { test, expect } from '@playwright/test'
import { executeCommand, openCommandPalette } from './helpers'

function installNestedVaultGitOverrides() {
  type Handler = (args?: Record<string, unknown>) => unknown
  type BrowserWindow = Window & typeof globalThis & {
    __gitPushCalls?: number
    __gitCommitVaultPaths?: string[]
    __nestedVaultPath?: string
    __mockHandlers?: Record<string, Handler>
    __mockHandlersRef?: Record<string, Handler> | null
  }

  const browserWindow = window as BrowserWindow

  const applyOverrides = (handlers?: Record<string, Handler> | null) => {
    if (!handlers) return handlers ?? null

    handlers.git_remote_status = () => ({ branch: 'main', ahead: 0, behind: 0, hasRemote: false })
    handlers.git_workspace_info = (args) => {
      const vaultPath = String(args?.vaultPath ?? '')
      browserWindow.__nestedVaultPath = vaultPath
      return {
        vaultRoot: vaultPath,
        gitRoot: '/parent-repository',
        vaultPathspec: 'docs',
        gitRootRelation: 'parent',
        resolutionFailure: null,
      }
    }
    handlers.git_commit = (args) => {
      browserWindow.__gitCommitVaultPaths?.push(String(args?.vaultPath ?? ''))
      return '[main abc1234] nested vault commit'
    }
    handlers.git_push = () => {
      browserWindow.__gitPushCalls = (browserWindow.__gitPushCalls ?? 0) + 1
      return { status: 'ok', message: 'Pushed to remote' }
    }

    return handlers
  }

  browserWindow.__gitPushCalls = 0
  browserWindow.__gitCommitVaultPaths = []

  let ref = applyOverrides(browserWindow.__mockHandlers) ?? null
  Object.defineProperty(browserWindow, '__mockHandlers', {
    configurable: true,
    set(value) {
      ref = applyOverrides(value as Record<string, Handler> | undefined) ?? null
    },
    get() {
      return applyOverrides(ref) ?? ref
    },
  })
}

test('nested parent-repository vault commits stay scoped and local without a remote @smoke', async ({ page }) => {
  test.setTimeout(60_000)
  await page.addInitScript(installNestedVaultGitOverrides)

  await page.goto('/')
  await page.waitForLoadState('networkidle')

  await expect(page.getByTestId('status-no-remote')).toContainText('No remote')

  await openCommandPalette(page)
  await executeCommand(page, 'Open Settings')
  const gitRoot = page.getByTestId('settings-git-root')
  await expect(gitRoot).toHaveText('/parent-repository')
  await gitRoot.focus()
  await expect(gitRoot).toBeFocused()
  await page.keyboard.press('Escape')

  await openCommandPalette(page)
  await executeCommand(page, 'Commit & Push')

  await expect(page.getByRole('heading', { name: 'Commit' })).toBeVisible()
  await expect(page.getByText(/local commit only/i)).toBeVisible()

  await page.locator('textarea[placeholder="Commit message..."]').fill('test local commit')
  await page.getByRole('button', { name: 'Commit', exact: true }).click()

  await expect(page.locator('.fixed.bottom-8')).toContainText('Committed locally', { timeout: 5000 })
  await expect.poll(async () =>
    page.evaluate(() => (window as Window & { __gitPushCalls?: number }).__gitPushCalls ?? 0),
  ).toBe(0)
  await expect.poll(async () => page.evaluate(() => {
    const browserWindow = window as Window & {
      __gitCommitVaultPaths?: string[]
      __nestedVaultPath?: string
    }
    return browserWindow.__gitCommitVaultPaths?.[0] === browserWindow.__nestedVaultPath
  })).toBe(true)
})
