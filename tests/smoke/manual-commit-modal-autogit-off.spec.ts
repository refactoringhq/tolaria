import { expect, test, type Page } from '@playwright/test'
import { executeCommand, openCommandPalette } from './helpers'
import { seedAutoGitSavedChange } from './testBridge'

type MockHandler = (args?: Record<string, unknown>) => unknown

function installCommitFlowMocks() {
  type BrowserWindow = Window & typeof globalThis & {
    __delayNextModifiedFiles?: boolean
    __gitCommitMessages?: string[]
    __gitPushCalls?: number
    __mockHandlers?: Record<string, MockHandler>
  }

  const browserWindow = window as BrowserWindow
  const dirtyPaths = new Set<string>()
  let ahead = 0

  const createModifiedFiles = () => [...dirtyPaths].map((path) => ({
    path,
    relativePath: path.split('/').pop() ?? path,
    status: 'modified',
  }))

  const isPatched = (handlers?: Record<string, MockHandler> | null) =>
    !handlers || (handlers as Record<string, unknown>).__manualCommitPatched === true

  const patchSaveNoteContent = (handlers: Record<string, MockHandler>) => {
    const originalSaveNoteContent = handlers.save_note_content
    handlers.save_note_content = (args?: Record<string, unknown>) => {
      const path = typeof args?.path === 'string' ? args.path : null
      if (path) dirtyPaths.add(path)
      return originalSaveNoteContent?.(args)
    }
  }

  const patchGitHandlers = (handlers: Record<string, MockHandler>) => {
    handlers.get_modified_files = async () => {
      const files = createModifiedFiles()
      if (browserWindow.__delayNextModifiedFiles) {
        browserWindow.__delayNextModifiedFiles = false
        await new Promise((resolve) => setTimeout(resolve, 800))
      }
      return files
    }
    handlers.git_commit = (args?: Record<string, unknown>) => {
      const message = typeof args?.message === 'string' ? args.message : ''
      browserWindow.__gitCommitMessages?.push(message)
      dirtyPaths.clear()
      ahead = 1
      return `[main abc1234] ${message}`
    }

    handlers.git_push = () => {
      browserWindow.__gitPushCalls = (browserWindow.__gitPushCalls ?? 0) + 1
      ahead = 0
      return { status: 'ok', message: 'Pushed to remote' }
    }

    handlers.git_remote_status = () => ({
      branch: 'main',
      ahead,
      behind: 0,
      hasRemote: true,
    })
  }

  const markPatched = (handlers: Record<string, MockHandler>) => {
    Object.defineProperty(handlers, '__manualCommitPatched', {
      configurable: true,
      enumerable: false,
      value: true,
    })
  }

  const patchHandlers = (handlers?: Record<string, MockHandler> | null) => {
    if (isPatched(handlers)) {
      return handlers ?? null
    }

    patchSaveNoteContent(handlers)
    patchGitHandlers(handlers)
    markPatched(handlers)
    return handlers
  }

  browserWindow.__gitCommitMessages = []
  browserWindow.__gitPushCalls = 0

  let ref = patchHandlers(browserWindow.__mockHandlers) ?? null
  Object.defineProperty(browserWindow, '__mockHandlers', {
    configurable: true,
    get() {
      return patchHandlers(ref) ?? ref
    },
    set(value) {
      ref = patchHandlers(value as Record<string, MockHandler> | undefined) ?? null
    },
  })
}

async function openFirstNote(page: Page) {
  const noteList = page.locator('[data-testid="note-list-container"]')
  await noteList.waitFor({ timeout: 5_000 })
  await noteList.locator('.cursor-pointer').first().click()
  await expect(page.locator('.bn-editor')).toBeVisible({ timeout: 5_000 })
}

async function setAutoGitEnabled(page: Page, enabled: boolean) {
  await openCommandPalette(page)
  await executeCommand(page, 'Open Settings')

  const settingsPanel = page.getByTestId('settings-panel')
  await expect(settingsPanel).toBeVisible({ timeout: 5_000 })

  const toggle = page.getByRole('switch', { name: 'AutoGit' })
  const isEnabled = (await toggle.getAttribute('aria-checked')) === 'true'
  if (isEnabled !== enabled) {
    await toggle.click()
  }

  await page.getByTestId('settings-save').click()
  await expect(settingsPanel).not.toBeVisible({ timeout: 5_000 })
}

async function triggerCommitButton(page: Page) {
  const commitButton = page.getByTestId('status-commit-push')
  await commitButton.focus()
  await expect(commitButton).toBeFocused()
  await page.keyboard.press('Enter')
}

async function delayNextModifiedFilesRequest(page: Page) {
  await page.evaluate(() => {
    const browserWindow = window as Window & {
      __delayNextModifiedFiles?: boolean
    }
    browserWindow.__delayNextModifiedFiles = true
  })
}

async function expectCommitMessage(page: Page, index: number, expectedMessage: string) {
  await expect.poll(async () =>
    page.evaluate(
      ({ targetIndex }) => (window as Window & { __gitCommitMessages?: string[] }).__gitCommitMessages?.[targetIndex] ?? '',
      { targetIndex: index },
    ),
  ).toBe(expectedMessage)
}

async function expectPushCount(page: Page, expectedCount: number) {
  await expect.poll(async () =>
    page.evaluate(() => (window as Window & { __gitPushCalls?: number }).__gitPushCalls ?? 0),
  ).toBe(expectedCount)
}

test('@smoke commit entry opens the manual modal when AutoGit is off and switches back immediately when enabled', async ({ page }) => {
  await page.addInitScript(installCommitFlowMocks)
  await page.goto('/')
  await page.waitForLoadState('networkidle')

  await openFirstNote(page)
  await setAutoGitEnabled(page, false)
  await seedAutoGitSavedChange(page)
  await delayNextModifiedFilesRequest(page)
  await triggerCommitButton(page)
  const commitButton = page.getByTestId('status-commit-push')

  await expect(commitButton).toHaveAttribute('aria-busy', 'true')
  await expect(commitButton).toHaveAttribute('aria-disabled', 'true')
  await expect(commitButton.locator('svg.animate-spin')).toBeVisible()
  await page.keyboard.press('Enter')

  await expect(page.getByRole('heading', { name: 'Commit & Push' })).toBeVisible()
  const messageInput = page.locator('textarea[placeholder="Commit message..."]')
  await expect(messageInput).toBeFocused()
  await page.keyboard.press('Meta+A')
  await page.keyboard.type('Manual commit from keyboard')
  await page.keyboard.press('Meta+Enter')

  await expect(page.locator('.fixed.bottom-8')).toContainText('Committed and pushed', { timeout: 5_000 })
  await expectCommitMessage(page, 0, 'Manual commit from keyboard')
  await expectPushCount(page, 1)

  await setAutoGitEnabled(page, true)
  await seedAutoGitSavedChange(page)
  await triggerCommitButton(page)

  await expect(messageInput).not.toBeVisible()
  await expectCommitMessage(page, 1, 'Updated 1 note')
  await expectPushCount(page, 2)
})
