import { test, expect } from '@playwright/test'

test('non-Git vault opens normally and shows Enable Git badge @smoke', async ({ page }) => {
  await page.addInitScript(() => {
    type Handler = (args?: Record<string, unknown>) => unknown

    const applyOverrides = (handlers?: Record<string, Handler> | null) => {
      if (!handlers) return handlers ?? null
      handlers.is_git_repo = () => false
      return handlers
    }

    let ref = applyOverrides(
      (window as Window & { __mockHandlers?: Record<string, Handler> }).__mockHandlers,
    ) ?? null
    Object.defineProperty(window, '__mockHandlers', {
      configurable: true,
      set(value) {
        ref = applyOverrides(value as Record<string, Handler> | undefined) ?? null
      },
      get() {
        return applyOverrides(ref) ?? ref
      },
    })
  })

  await page.goto('/')
  await page.waitForLoadState('networkidle')

  await expect(page.getByTestId('status-enable-git')).toBeVisible()
  await expect(page.getByTestId('status-commit-push')).not.toBeVisible()
  await expect(page.getByTestId('status-pulse')).not.toBeVisible()
})

test('Enable Git dialog opens and resolves to Git-enabled vault @smoke', async ({ page }) => {
  await page.addInitScript(() => {
    type Handler = (args?: Record<string, unknown>) => unknown

    let isGit = false

    const applyOverrides = (handlers?: Record<string, Handler> | null) => {
      if (!handlers) return handlers ?? null
      handlers.is_git_repo = () => isGit
      handlers.init_git_repo = () => {
        isGit = true
        return undefined
      }
      return handlers
    }

    let ref = applyOverrides(
      (window as Window & { __mockHandlers?: Record<string, Handler> }).__mockHandlers,
    ) ?? null
    Object.defineProperty(window, '__mockHandlers', {
      configurable: true,
      set(value) {
        ref = applyOverrides(value as Record<string, Handler> | undefined) ?? null
      },
      get() {
        return applyOverrides(ref) ?? ref
      },
    })
  })

  await page.goto('/')
  await page.waitForLoadState('networkidle')

  await expect(page.getByTestId('status-enable-git')).toBeVisible()
  await page.getByTestId('status-enable-git').click()

  await expect(page.getByTestId('enable-git-dialog')).toBeVisible()

  await page.getByTestId('enable-git-confirm').click()

  await expect(page.getByTestId('status-enable-git')).not.toBeVisible({ timeout: 5000 })
  await expect(page.getByTestId('status-pulse')).toBeVisible()
})
