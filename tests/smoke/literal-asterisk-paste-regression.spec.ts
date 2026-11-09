import { expect, type Page, test } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'
import { createFixtureVaultCopy, openFixtureVault, removeFixtureVaultCopy } from '../helpers/fixtureVault'

let tempVaultDir: string
let notePath: string

const sqlSnippet = 'SELECT * FROM OPENQUERY'
const linkedCodeMarkdown = '[`some-symbol`](https://example.com)'

function writePasteNote(vaultPath: string): string {
  const targetPath = path.join(vaultPath, 'note', 'literal-asterisk-paste.md')
  fs.writeFileSync(targetPath, [
    '---',
    'Is A: Note',
    'Status: Active',
    '---',
    '',
    '# Literal Asterisk Paste',
    '',
    'Paste target',
    '',
  ].join('\n'), 'utf8')
  return targetPath
}

async function openNote(page: Page, title: string): Promise<void> {
  await page.locator('[data-testid="note-list-container"]').getByText(title, { exact: true }).click()
  await expect(page.locator('.bn-editor')).toBeVisible({ timeout: 5_000 })
}

async function pasteText(page: Page, text: string): Promise<void> {
  await page.evaluate(async (value) => {
    await navigator.clipboard.writeText(value)
  }, text)
  await page.keyboard.press(process.platform === 'darwin' ? 'Meta+V' : 'Control+V')
}

test.beforeEach(async ({ page, context }, testInfo) => {
  testInfo.setTimeout(90_000)
  tempVaultDir = createFixtureVaultCopy()
  notePath = writePasteNote(tempVaultDir)
  await context.grantPermissions(['clipboard-read', 'clipboard-write'])
  await openFixtureVault(page, tempVaultDir)
})

test.afterEach(async () => {
  removeFixtureVaultCopy(tempVaultDir)
})

test('rich editor paste preserves literal SQL wildcard asterisks', async ({ page }) => {
  await openNote(page, 'Literal Asterisk Paste')

  const targetParagraph = page.locator('.bn-editor [data-content-type="paragraph"]').filter({ hasText: 'Paste target' }).first()
  await targetParagraph.click()
  await page.keyboard.press('End')
  await page.keyboard.press('Enter')
  await pasteText(page, sqlSnippet)

  await expect(page.locator('.bn-editor')).toContainText(sqlSnippet, { timeout: 5_000 })
  await expect.poll(() => fs.readFileSync(notePath, 'utf8'), { timeout: 10_000 }).toContain(sqlSnippet)
  expect(fs.readFileSync(notePath, 'utf8')).not.toContain('SELECT  FROM OPENQUERY')
})

test("pasting file-like text can be undone and redone", async ({ page }) => {
	await openNote(page, "Literal Asterisk Paste");

	const targetParagraph = page
		.locator('.bn-editor [data-content-type="paragraph"]')
		.filter({ hasText: "Paste target" })
		.first();
	await targetParagraph.click();
	await page.keyboard.press("End");
	await page.keyboard.press("Enter");

	for (const pastedText of [
		"example.py",
		"notes.md",
		"script.js",
		"example.com",
	]) {
		await pasteText(page, pastedText);

		await expect(page.locator(".bn-editor")).toContainText(pastedText, { timeout: 5_000 });
		await page.keyboard.press(process.platform === "darwin" ? "Meta+Z" : "Control+Z");
		await expect(page.locator(".bn-editor")).not.toContainText(pastedText);
		await page.keyboard.press(process.platform === "darwin" ? "Meta+Shift+Z" : "Control+Shift+Z");
		await expect(page.locator(".bn-editor")).toContainText(pastedText);
		await page.keyboard.press(process.platform === "darwin" ? "Meta+Z" : "Control+Z");
		await expect(page.locator(".bn-editor")).not.toContainText(pastedText);
	}

	await page.keyboard.type("ordinary text");
	await page.keyboard.press(process.platform === "darwin" ? "Meta+Z" : "Control+Z");
	await expect(page.locator(".bn-editor")).not.toContainText("ordinary text");
});

test('rich editor paste preserves Markdown links with inline-code labels @smoke', async ({ page }) => {
  const pageErrors: string[] = []
  page.on('pageerror', error => pageErrors.push(error.message))
  await openNote(page, 'Literal Asterisk Paste')

  const targetParagraph = page.locator('.bn-editor [data-content-type="paragraph"]').filter({ hasText: 'Paste target' }).first()
  await targetParagraph.click()
  await page.keyboard.press('End')
  await page.keyboard.press('Enter')
  await pasteText(page, linkedCodeMarkdown)
  expect(pageErrors).toEqual([])

  const linkedCode = page.locator('.bn-editor a[href="https://example.com"] code', { hasText: 'some-symbol' })
  await expect(linkedCode).toBeVisible({ timeout: 5_000 })
  await expect.poll(() => fs.readFileSync(notePath, 'utf8'), { timeout: 10_000 }).toContain(linkedCodeMarkdown)
})
