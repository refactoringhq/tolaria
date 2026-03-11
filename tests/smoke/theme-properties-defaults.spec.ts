import { test, expect, type Page } from '@playwright/test'

async function getCssVar(page: Page, name: string): Promise<string> {
  return page.evaluate(
    (n) => document.documentElement.style.getPropertyValue(n),
    name,
  )
}

/**
 * Programmatically switch theme by calling mock handlers and triggering reload.
 * This avoids relying on command palette label matching.
 */
async function activateTheme(page: Page, themePath: string) {
  await page.evaluate((path) => {
    const win = window as Record<string, unknown>
    const handlers = win.__mockHandlers as Record<string, (...args: unknown[]) => unknown>
    if (handlers?.set_active_theme) {
      handlers.set_active_theme({ themeId: path })
    }
  }, themePath)

  // The app polls vault settings on window focus, trigger a focus event
  await page.evaluate(() => window.dispatchEvent(new Event('focus')))
  await page.waitForTimeout(1000)
}

test.describe('Theme properties defaults', () => {
  test.beforeEach(async ({ page }) => {
    // Block the vault API ping so the app falls back to mock content
    // instead of reading real files from the filesystem.
    await page.route('**/api/vault/ping', (route) =>
      route.fulfill({ status: 404, body: 'blocked for testing' }),
    )
    await page.goto('/')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(1000)
  })

  test('default theme applies all editor CSS vars from frontmatter', async ({ page }) => {
    await activateTheme(page, '/Users/luca/Laputa/theme/default.md')

    // Wait for CSS vars to be applied
    await expect(async () => {
      expect(await getCssVar(page, '--background')).toBe('#FFFFFF')
    }).toPass({ timeout: 5000 })

    // Editor properties that were previously missing from frontmatter
    expect(await getCssVar(page, '--editor-font-size')).toBe('15px')
    expect(await getCssVar(page, '--editor-max-width')).toBe('720px')
    expect(await getCssVar(page, '--editor-padding-horizontal')).toBe('40px')

    // Heading properties
    expect(await getCssVar(page, '--headings-h1-font-size')).toBe('32px')
    expect(await getCssVar(page, '--headings-h1-font-weight')).toBe('700')

    // List properties
    expect(await getCssVar(page, '--lists-bullet-size')).toBe('28px')
    expect(await getCssVar(page, '--lists-bullet-color')).toBe('#177bfd')

    // Checkbox properties
    expect(await getCssVar(page, '--checkboxes-size')).toBe('18px')

    // Inline styles
    expect(await getCssVar(page, '--inline-styles-bold-font-weight')).toBe('700')

    // Code blocks
    expect(await getCssVar(page, '--code-blocks-font-size')).toBe('13px')

    // Blockquote
    expect(await getCssVar(page, '--blockquote-border-left-width')).toBe('3px')

    // Table
    expect(await getCssVar(page, '--table-font-size')).toBe('14px')

    // Horizontal rule
    expect(await getCssVar(page, '--horizontal-rule-thickness')).toBe('1px')

    // Colors semantic aliases (should resolve to var() references)
    expect(await getCssVar(page, '--colors-text')).toBe('var(--text-primary)')
    expect(await getCssVar(page, '--colors-cursor')).toBe('var(--text-primary)')

    // Semantic vars that were previously undefined
    expect(await getCssVar(page, '--text-tertiary')).toBe('#B4B4B4')
    expect(await getCssVar(page, '--bg-card')).toBe('#FFFFFF')
    expect(await getCssVar(page, '--border-primary')).toBe('#E9E9E7')
  })

  test('newly created theme frontmatter contains all default properties', async ({ page }) => {
    // Call create_vault_theme mock and read the generated content
    const content = await page.evaluate(() => {
      const win = window as Record<string, unknown>
      const handlers = win.__mockHandlers as Record<string, (...args: unknown[]) => unknown>
      const mockContent = win.__mockContent as Record<string, string>
      if (!handlers?.create_vault_theme) return 'no handler'

      const path = handlers.create_vault_theme({
        vaultPath: '/Users/luca/Laputa',
        name: 'Test Theme',
      }) as string

      return mockContent[path] || 'no content'
    })

    // Verify frontmatter includes ALL editor properties
    expect(content).toContain('editor-font-size:')
    expect(content).toContain('editor-max-width:')
    expect(content).toContain('editor-padding-horizontal:')
    expect(content).toContain('headings-h1-font-size:')
    expect(content).toContain('headings-h2-font-weight:')
    expect(content).toContain('lists-bullet-size:')
    expect(content).toContain('lists-bullet-color:')
    expect(content).toContain('checkboxes-size:')
    expect(content).toContain('inline-styles-bold-font-weight:')
    expect(content).toContain('inline-styles-code-font-family:')
    expect(content).toContain('code-blocks-font-family:')
    expect(content).toContain('blockquote-border-left-width:')
    expect(content).toContain('table-border-color:')
    expect(content).toContain('horizontal-rule-thickness:')
    expect(content).toContain('colors-text:')
    expect(content).toContain('colors-cursor:')

    // Verify numeric values have px units
    expect(content).toContain('editor-font-size: 15px')
    expect(content).toContain('editor-max-width: 720px')

    // Verify semantic vars are present
    expect(content).toContain('text-tertiary:')
    expect(content).toContain('bg-card:')
    expect(content).toContain('border-primary:')
  })

  test('dark theme applies dark-specific color overrides', async ({ page }) => {
    await activateTheme(page, '/Users/luca/Laputa/theme/dark.md')

    await expect(async () => {
      expect(await getCssVar(page, '--background')).toBe('#0f0f1a')
    }).toPass({ timeout: 5000 })

    // Dark overrides
    expect(await getCssVar(page, '--bg-card')).toBe('#16162a')
    expect(await getCssVar(page, '--text-primary')).toBe('#e0e0e0')
    expect(await getCssVar(page, '--border-primary')).toBe('#2a2a4a')

    // Editor properties should still be present (inherited from defaults)
    expect(await getCssVar(page, '--editor-font-size')).toBe('15px')
    expect(await getCssVar(page, '--headings-h1-font-size')).toBe('32px')
    expect(await getCssVar(page, '--lists-bullet-size')).toBe('28px')
  })
})
