import { test, expect } from '@playwright/test'

test.describe('Wikilink insertion and navigation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.waitForTimeout(500)

    // Select first note to open in editor
    const noteItem = page.locator('.app__note-list .cursor-pointer').first()
    await noteItem.click()
    await page.waitForTimeout(1000)
  })

  test('[[ autocomplete inserts wikilink that is not broken', async ({ page }) => {
    // Focus editor and move to a new line
    const editor = page.locator('.bn-editor')
    await expect(editor).toBeVisible({ timeout: 5000 })
    await editor.click()
    await page.keyboard.press('End')
    await page.keyboard.press('Enter')
    await page.waitForTimeout(200)

    // Type [[ then a query (>= 2 chars for MIN_QUERY_LENGTH)
    await page.keyboard.type('[[Ma')
    await page.waitForTimeout(800)

    // The wikilink suggestion menu should appear
    const suggestionMenu = page.locator('.wikilink-menu')
    await expect(suggestionMenu).toBeVisible({ timeout: 5000 })

    // Select the first suggestion
    await page.keyboard.press('Enter')
    await page.waitForTimeout(500)

    // A wikilink should have been inserted
    const wikilinks = page.locator('.wikilink')
    const count = await wikilinks.count()
    expect(count).toBeGreaterThanOrEqual(1)

    // The wikilink should NOT be broken
    const lastWikilink = wikilinks.last()
    const isBroken = await lastWikilink.evaluate(
      el => el.classList.contains('wikilink--broken'),
    )
    expect(isBroken).toBe(false)

    // The wikilink should have a data-target attribute
    const target = await lastWikilink.getAttribute('data-target')
    expect(target).toBeTruthy()
  })

  test('clicking an inserted wikilink navigates to the note', async ({ page }) => {
    // Insert a wikilink via autocomplete
    const editor = page.locator('.bn-editor')
    await expect(editor).toBeVisible({ timeout: 5000 })
    await editor.click()
    await page.keyboard.press('End')
    await page.keyboard.press('Enter')
    await page.keyboard.type('[[Ma')
    await page.waitForTimeout(800)

    const suggestionMenu = page.locator('.wikilink-menu')
    await expect(suggestionMenu).toBeVisible({ timeout: 5000 })
    await page.keyboard.press('Enter')
    await page.waitForTimeout(500)

    // Get the wikilink that was just inserted
    const wikilink = page.locator('.wikilink').last()
    await expect(wikilink).toBeVisible()
    const targetTitle = await wikilink.textContent()

    // Click the wikilink to navigate
    await wikilink.click()
    await page.waitForTimeout(1000)

    // The editor should now show the target note
    const heading = page.locator('.bn-editor h1')
    await expect(heading).toBeVisible({ timeout: 3000 })
    const headingText = await heading.textContent()
    // The heading should match the beginning of the target note's title
    expect(headingText?.toLowerCase()).toContain(targetTitle?.toLowerCase().substring(0, 4) || '')
  })
})
