import { test, expect, type Page } from '@playwright/test'
import { createFixtureVaultCopy, openFixtureVault, removeFixtureVaultCopy } from '../helpers/fixtureVault'
import { executeCommand, openCommandPalette, sendShortcut } from './helpers'

let tempVaultDir: string

test.beforeEach(async ({ page }, testInfo) => {
  testInfo.setTimeout(60_000)
  tempVaultDir = createFixtureVaultCopy()
  await openFixtureVault(page, tempVaultDir)
})

test.afterEach(async () => {
  removeFixtureVaultCopy(tempVaultDir)
})

async function openNote(page: Page, title: string) {
  const noteList = page.locator('[data-testid="note-list-container"]')
  await noteList.getByText(title, { exact: true }).click()
}

async function openRawMode(page: Page) {
  await openCommandPalette(page)
  await executeCommand(page, 'Toggle Raw')
  await expect(page.locator('.cm-content')).toBeVisible({ timeout: 5_000 })
}

async function openBlockNoteMode(page: Page) {
  await openCommandPalette(page)
  await executeCommand(page, 'Toggle Raw')
  await expect(page.locator('.bn-editor')).toBeVisible({ timeout: 5_000 })
}

async function getRawEditorContent(page: Page): Promise<string> {
  return page.evaluate(() => {
    const el = document.querySelector('.cm-content')
    if (!el) return ''
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const view = (el as any).cmTile?.view
    if (view) return view.state.doc.toString() as string
    return el.textContent ?? ''
  })
}

async function setRawEditorContent(page: Page, content: string) {
  await page.evaluate((newContent) => {
    const el = document.querySelector('.cm-content')
    if (!el) return
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const view = (el as any).cmTile?.view
    if (!view) return
    view.dispatch({
      changes: { from: 0, to: view.state.doc.length, insert: newContent },
    })
  }, content)
}

async function openQuickOpen(page: Page) {
  await page.locator('body').click()
  await sendShortcut(page, 'p', ['Control'])
  await expect(page.locator('input[placeholder="Search notes..."]')).toBeVisible({ timeout: 5_000 })
}

test('creating an untitled draft hides the legacy title section in the editor', async ({ page }) => {
  await page.locator('button[title="Create new note"]').click()

  await expect(page.getByRole('textbox').last()).toBeVisible({ timeout: 5_000 })
  await expect(page.getByTestId('title-field-input')).toHaveCount(0)
  await expect(page.locator('.title-section[data-title-ui-visible]')).toHaveCount(0)
})

test('@smoke older notes with an H1 do not render the legacy title section', async ({ page }) => {
  await openNote(page, 'Alpha Project')

  await expect(page.locator('.bn-editor')).toBeVisible({ timeout: 5_000 })
  await expect(page.getByTestId('title-field-input')).toHaveCount(0)
  await expect(page.locator('.title-section[data-title-ui-visible]')).toHaveCount(0)
})

test('@smoke edited H1 titles drive note list, search, and wikilink autocomplete', async ({ page }) => {
  const updatedTitle = 'Updated Display Title'
  const noteList = page.locator('[data-testid="note-list-container"]')

  await openNote(page, 'Note B')
  await openRawMode(page)

  const rawContent = await getRawEditorContent(page)
  expect(rawContent).toContain('# Note B')

  await setRawEditorContent(page, rawContent.replace('# Note B', `# ${updatedTitle}`))
  await page.waitForTimeout(700)
  await page.keyboard.press('Meta+s')
  await openBlockNoteMode(page)

  await expect(page.getByRole('heading', { name: updatedTitle, level: 1 })).toBeVisible({ timeout: 5_000 })
  await expect(noteList.getByText(updatedTitle, { exact: true })).toBeVisible({ timeout: 5_000 })
  await expect(noteList.getByText('Note B', { exact: true })).toHaveCount(0)

  await openQuickOpen(page)
  const quickOpenInput = page.locator('input[placeholder="Search notes..."]')
  await quickOpenInput.fill(updatedTitle)
  await expect(page.locator('[class*="bg-accent"] span.truncate').first()).toHaveText(updatedTitle, { timeout: 5_000 })
  await page.keyboard.press('Escape')

  await openNote(page, 'Alpha Project')
  const editor = page.locator('.bn-editor')
  await expect(editor).toBeVisible({ timeout: 5_000 })
  await editor.click()
  await page.keyboard.press('End')
  await page.keyboard.press('Enter')
  await page.keyboard.type('[[Up')

  const suggestionMenu = page.locator('.wikilink-menu')
  await expect(suggestionMenu).toContainText(updatedTitle, { timeout: 5_000 })
})
