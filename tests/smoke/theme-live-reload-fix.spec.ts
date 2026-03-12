import { test, expect, type Page } from '@playwright/test'
import { openCommandPalette, executeCommand } from './helpers'

async function getCssVar(page: Page, name: string): Promise<string> {
  return page.evaluate(
    (n) => document.documentElement.style.getPropertyValue(n),
    name,
  )
}

async function switchToDefaultTheme(page: Page) {
  await openCommandPalette(page)
  await executeCommand(page, 'Switch to Default Theme')
  await expect(async () => {
    expect(await getCssVar(page, '--background')).toBe('#FFFFFF')
  }).toPass({ timeout: 5000 })
}

async function openThemeNoteInRawMode(page: Page) {
  await openCommandPalette(page)
  await executeCommand(page, 'Edit Default Theme')
  await page.waitForTimeout(500)

  await openCommandPalette(page)
  await executeCommand(page, 'Toggle Raw Editor')
  await expect(page.locator('.cm-content')).toBeVisible({ timeout: 3000 })
}

/** Replace all text in the CodeMirror editor via its EditorView API. */
async function setCmContent(page: Page, newContent: string) {
  await page.evaluate((text) => {
    const cmContent = document.querySelector('.cm-content') as HTMLElement | null
    if (!cmContent) throw new Error('No .cm-content found')
    // Access EditorView via CodeMirror's internal DOM reference
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const view = (cmContent as any).cmTile?.root?.view
    if (!view) throw new Error('No EditorView found on .cm-content')
    view.dispatch({
      changes: { from: 0, to: view.state.doc.length, insert: text },
    })
  }, newContent)
}

test.describe('Theme live reload on save', () => {
  // FIXME: these tests assume the default theme is light (#FFFFFF background)
  // but the mock/test environment now starts with a dark theme (#1a1a2e).
  // Skipping until the test fixture is updated.
  test.skip()

  test.beforeEach(async ({ page }) => {
    // Block the vault API ping so the app falls back to mock content
    // instead of reading real files from the filesystem.
    await page.route('**/api/vault/ping', (route) =>
      route.fulfill({ status: 404, body: 'blocked for testing' }),
    )
    await page.goto('/')
    await page.waitForLoadState('networkidle')
  })

  test.fixme('editing theme frontmatter and saving updates CSS vars immediately', async ({ page }) => {
    // 1. Switch to the default theme
    await switchToDefaultTheme(page)
    expect(await getCssVar(page, '--background')).toBe('#FFFFFF')
    expect(await getCssVar(page, '--sidebar')).toBe('#F7F6F3')

    // 2. Open the theme note in raw editor mode
    await openThemeNoteInRawMode(page)

    // 3. Replace content via CodeMirror API with changed colors
    const updatedContent = [
      '---',
      'type: Theme',
      'title: Default',
      'primary: "#155DFF"',
      'background: "#1a1a2e"',
      'foreground: "#37352F"',
      'sidebar: "#2a2a3e"',
      'border: "#E9E9E7"',
      'muted: "#F0F0EF"',
      'muted-foreground: "#9B9A97"',
      'accent: "#F0F7FF"',
      'accent-foreground: "#0A3B8F"',
      'font-family: "\'Inter\', -apple-system, BlinkMacSystemFont, sans-serif"',
      'font-size-base: 14',
      'line-height-base: 1.6',
      '---',
      '',
      '# Default',
      '',
      'Light theme with warm, paper-like tones.',
    ].join('\n')
    await setCmContent(page, updatedContent)

    // Wait for debounce to flush (RawEditorView has 500ms debounce)
    await page.waitForTimeout(700)

    // 4. Save with Ctrl+S
    await page.keyboard.press('Control+s')

    // 5. Verify CSS vars updated live
    await expect(async () => {
      expect(await getCssVar(page, '--background')).toBe('#1a1a2e')
    }).toPass({ timeout: 5000 })
    expect(await getCssVar(page, '--sidebar')).toBe('#2a2a3e')
  })

  test.fixme('saving a non-theme note does not affect active theme CSS', async ({ page }) => {
    // 1. Switch to the default theme
    await switchToDefaultTheme(page)
    expect(await getCssVar(page, '--background')).toBe('#FFFFFF')

    // 2. Open a regular note (first in list), switch to raw mode
    const noteList = page.locator('[data-testid="note-list-container"]')
    await noteList.waitFor({ timeout: 5000 })
    await noteList.locator('.cursor-pointer').first().click()
    await page.waitForTimeout(300)

    await openCommandPalette(page)
    await executeCommand(page, 'Toggle Raw Editor')
    await expect(page.locator('.cm-content')).toBeVisible({ timeout: 3000 })

    // 3. Type something and save
    await page.locator('.cm-content').click()
    await page.keyboard.type('test edit')
    await page.keyboard.press('Control+s')
    await page.waitForTimeout(500)

    // 4. Theme CSS vars unchanged
    expect(await getCssVar(page, '--background')).toBe('#FFFFFF')
  })
})
