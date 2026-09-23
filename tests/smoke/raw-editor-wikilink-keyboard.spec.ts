import { expect, test, type Page } from '@playwright/test'
import { executeCommand, openCommandPalette } from './helpers'

type RawEditorHost = HTMLElement & {
  __cmView?: {
    focus: () => void
    state: {
      doc: { length: number; toString: () => string }
      selection: { main: { head: number } }
    }
    dispatch: (transaction: { selection: { anchor: number } }) => void
  }
}

async function openRawEditor(page: Page): Promise<void> {
  await page.goto('/')
  await page.waitForLoadState('networkidle')
  await page.getByText('Grow Newsletter', { exact: true }).first().click()
  await expect(page.locator('.bn-editor')).toBeVisible({ timeout: 5_000 })
  await openCommandPalette(page)
  await executeCommand(page, 'Toggle Raw')
  await expect(page.getByTestId('raw-editor-codemirror')).toBeVisible({ timeout: 5_000 })
}

async function focusRawEditorEnd(page: Page): Promise<void> {
  await page.getByTestId('raw-editor-codemirror').evaluate((element) => {
    const view = (element as RawEditorHost).__cmView
    if (!view) throw new Error('Raw CodeMirror view is unavailable')
    view.dispatch({ selection: { anchor: view.state.doc.length } })
    view.focus()
  })
}

async function rawEditorState(page: Page): Promise<{ cursor: number; doc: string }> {
  return page.getByTestId('raw-editor-codemirror').evaluate((element) => {
    const view = (element as RawEditorHost).__cmView
    if (!view) throw new Error('Raw CodeMirror view is unavailable')
    return {
      cursor: view.state.selection.main.head,
      doc: view.state.doc.toString(),
    }
  })
}

test('@smoke raw wikilink suggestions support Arrow keys, Enter, and Escape', async ({ page }) => {
  await openRawEditor(page)
  await focusRawEditorEnd(page)
  await page.keyboard.type('\n[[Ma')

  const menu = page.getByTestId('raw-editor-wikilink-dropdown')
  await expect(menu).toBeVisible()
  const initialSelection = menu.locator('.bg-accent')
  const initialTitle = await initialSelection.textContent()
  const beforeArrow = await rawEditorState(page)

  await page.keyboard.press('ArrowDown')
  await expect(menu.locator('.bg-accent')).not.toHaveText(initialTitle ?? '')
  expect((await rawEditorState(page)).cursor).toBe(beforeArrow.cursor)

  await page.keyboard.press('ArrowUp')
  await expect(menu.locator('.bg-accent')).toHaveText(initialTitle ?? '')

  await page.keyboard.press('Escape')
  await expect(menu).not.toBeVisible()

  await page.keyboard.type('n')
  await expect(menu).toBeVisible()
  await page.keyboard.press('Enter')
  await expect(menu).not.toBeVisible()
  expect((await rawEditorState(page)).doc).toContain('[[manage-sponsorships]]')
})

test('@smoke raw editor Shift+Tab outdents without moving focus to app chrome', async ({ page }) => {
  await openRawEditor(page)
  await focusRawEditorEnd(page)
  await page.keyboard.press('Enter')
  await page.keyboard.press('Tab')
  await page.keyboard.type('- child')

  expect((await rawEditorState(page)).doc).toMatch(/\n\t- child$/u)

  await page.keyboard.press('Shift+Tab')

  await expect(page.locator('.cm-content')).toBeFocused()
  expect((await rawEditorState(page)).doc).toMatch(/\n- child$/u)
})
