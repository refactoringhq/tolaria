import fs from 'fs'
import { test, expect, type Page } from '@playwright/test'
import { createFixtureVaultCopy, openFixtureVaultTauri, removeFixtureVaultCopy } from '../helpers/fixtureVault'
import { triggerMenuCommand } from './testBridge'

const KNOWN_EDITOR_ERRORS = ['isConnected']

function isKnownEditorError(message: string): boolean {
  return KNOWN_EDITOR_ERRORS.some((known) => message.includes(known))
}

function markdownFiles(vaultPath: string): string[] {
  return fs.readdirSync(vaultPath).filter((name) => name.endsWith('.md')).sort()
}

function slugifyTitle(title: string): string {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
}

async function createUntitledNote(page: Page): Promise<void> {
  await page.locator('body').click()
  await triggerMenuCommand(page, 'file-new-note')
  await expect(page.locator('.bn-editor')).toBeVisible({ timeout: 5_000 })
  await expect(page.getByTestId('breadcrumb-filename-trigger')).toContainText(/untitled-note-\d+(?:-\d+)?/i, {
    timeout: 5_000,
  })
  await expectReadyEmptyTitleHeading(page)
}

async function writeNewHeading(page: Page, title: string): Promise<void> {
  await page.keyboard.type(title)
  await page.keyboard.press('Enter')
}

async function expectRenamedFile(vaultPath: string, filename: string): Promise<void> {
  await expect(async () => {
    expect(markdownFiles(vaultPath)).toContain(filename)
  }).toPass({ timeout: 10_000 })
}

async function expectFileContentContains(vaultPath: string, filename: string, text: string): Promise<void> {
  await expect(async () => {
    const content = fs.readFileSync(`${vaultPath}/${filename}`, 'utf-8')
    expect(content).toContain(text)
  }).toPass({ timeout: 10_000 })
}

async function expectActiveFilename(page: Page, filenameStem: string): Promise<void> {
  await expect(page.getByTestId('breadcrumb-filename-trigger')).toContainText(filenameStem, { timeout: 10_000 })
}

async function expectEditorFocused(page: Page): Promise<void> {
  await expect.poll(async () => page.evaluate(() => {
    const active = document.activeElement as HTMLElement | null
    return Boolean(active?.isContentEditable || active?.closest('[contenteditable="true"]'))
  }), {
    timeout: 5_000,
  }).toBe(true)
}

async function expectReadyEmptyTitleHeading(page: Page): Promise<void> {
  await expectEditorFocused(page)
  await expect.poll(async () => page.evaluate(() => {
    const firstBlock = document.querySelector('.bn-block-content') as HTMLElement | null
    const inlineHeading = firstBlock?.querySelector('.bn-inline-content') as HTMLElement | null
    return {
      contentType: firstBlock?.getAttribute('data-content-type') ?? null,
      placeholder: inlineHeading ? getComputedStyle(inlineHeading, '::before').content : null,
    }
  }), {
    timeout: 5_000,
  }).toEqual({
    contentType: 'heading',
    placeholder: '"Title"',
  })
}

let tempVaultDir: string

test.beforeEach(async ({ page }, testInfo) => {
  testInfo.setTimeout(90_000)
  tempVaultDir = createFixtureVaultCopy()
  await openFixtureVaultTauri(page, tempVaultDir)
})

test.afterEach(async () => {
  removeFixtureVaultCopy(tempVaultDir)
})

test('@smoke new-note H1 auto-rename keeps the editor usable and leaves no untitled duplicates', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (err) => {
    if (!isKnownEditorError(err.message)) errors.push(err.message)
  })

  const titles = [
    'Fresh Focus Title',
    'Rapid Rename 2',
    'Rapid Rename 3',
    'Rapid Rename 4',
    'Rapid Rename 5',
  ]

  for (const [index, title] of titles.entries()) {
    await createUntitledNote(page)
    await writeNewHeading(page, title)
    await expectActiveFilename(page, slugifyTitle(title))
    await expectRenamedFile(tempVaultDir, `${slugifyTitle(title)}.md`)
    await expectEditorFocused(page)
    await expectFileContentContains(tempVaultDir, `${slugifyTitle(title)}.md`, `# ${title}`)

    if (index === 0) {
      await page.keyboard.type(' focus-probe')
      await expectFileContentContains(tempVaultDir, 'fresh-focus-title.md', 'focus-probe')
    }
  }

  const files = markdownFiles(tempVaultDir)
  expect(files).toContain('fresh-focus-title.md')
  expect(files.filter((name) => name.startsWith('untitled-note-'))).toEqual([])
  expect(files.filter((name) => /^rapid-rename-\d+\.md$/.test(name))).toHaveLength(4)
  expect(errors).toEqual([])
})
