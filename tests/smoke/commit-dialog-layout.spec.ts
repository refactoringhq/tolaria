import { expect, test } from '@playwright/test'
import { executeCommand, openCommandPalette } from './helpers'

type Handler = (args?: Record<string, unknown>) => unknown
type BrowserWindow = Window & typeof globalThis & { __mockHandlers?: Record<string, Handler> }

// Swaps in a long author email, the case that used to push the dialog content past its edge.
function installLongAuthorScript() {
  const browserWindow = window as BrowserWindow
  const withLongAuthor = (handlers?: Record<string, Handler> | null) => {
    if (handlers) {
      handlers.git_author_identity = () => ({
        name: 'Tolaria',
        email: 'very.long.commit.author.address+tolaria-vault@example-organization.com',
        source: 'global',
        warning: null,
      })
    }
    return handlers ?? null
  }

  let ref = withLongAuthor(browserWindow.__mockHandlers)
  Object.defineProperty(browserWindow, '__mockHandlers', {
    configurable: true,
    set(value) {
      ref = withLongAuthor(value as Record<string, Handler> | undefined)
    },
    get() {
      return ref
    },
  })
}

test('commit dialog keeps every control inside its bounds', async ({ page }) => {
  await page.addInitScript(installLongAuthorScript)
  await page.goto('/', { timeout: 45_000, waitUntil: 'domcontentloaded' })
  await expect(page.getByRole('heading', { name: 'Inbox' })).toBeVisible({ timeout: 20_000 })

  await openCommandPalette(page)
  await executeCommand(page, 'Commit & Push')
  await expect(page.getByRole('heading', { name: 'Commit & Push' })).toBeVisible()
  await expect(page.getByTestId('commit-author-identity')).toContainText('Tolaria')

  const overflowing = await page.locator('[data-slot="dialog-content"]').evaluate((dialog) => {
    const bounds = dialog.getBoundingClientRect()
    const padding = parseFloat(getComputedStyle(dialog).paddingRight)
    const contentRight = bounds.right - padding
    return Array.from(dialog.querySelectorAll('button, textarea, [data-slot="badge"], [data-testid="commit-author-identity"]'))
      .filter((element) => element.getBoundingClientRect().right > contentRight + 0.5)
      .map((element) => element.textContent?.trim() || element.tagName)
  })

  expect(overflowing).toEqual([])
})
