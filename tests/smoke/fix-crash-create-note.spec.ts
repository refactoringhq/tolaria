import fs from 'fs'
import path from 'path'
import { test, expect, type Page } from '@playwright/test'
import { executeCommand, openCommandPalette, sendShortcut } from './helpers'
import { createFixtureVaultCopy, openFixtureVault, removeFixtureVaultCopy } from '../helpers/fixtureVault'

let tempVaultDir: string

function seedTypeEntry(vaultPath: string, typeName: string, template: string): void {
  const slug = typeName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'type'
  const body = [
    '---',
    `title: ${typeName}`,
    'type: Type',
    'template: |',
    ...template.split('\n').map((line) => `  ${line}`),
    '---',
    '',
  ].join('\n')
  fs.writeFileSync(path.join(vaultPath, `${slug}.md`), body)
}

async function openTestVault(page: Page): Promise<void> {
  await openFixtureVault(page, tempVaultDir)
}

async function selectSection(page: Page, label: string): Promise<void> {
  await page.locator('aside').getByText(label, { exact: true }).first().click()
}

async function createNoteFromListHeader(page: Page): Promise<void> {
  await page.locator('button[title="Create new note"]').click()
}

function untitledRow(page: Page, typeLabel: string) {
  return page.getByText(new RegExp(`^Untitled ${typeLabel}(?: \\d+)?$`, 'i')).first()
}

async function expectReadyEmptyTitleHeading(page: Page): Promise<void> {
  await expect.poll(async () => page.evaluate(() => {
    const active = document.activeElement as HTMLElement | null
    const firstBlock = document.querySelector('.bn-block-content') as HTMLElement | null
    const inlineHeading = firstBlock?.querySelector('.bn-inline-content') as HTMLElement | null
    return {
      editorFocused: Boolean(active?.isContentEditable || active?.closest('[contenteditable="true"]')),
      contentType: firstBlock?.getAttribute('data-content-type') ?? null,
      placeholder: inlineHeading ? getComputedStyle(inlineHeading, '::before').content : null,
    }
  }), {
    timeout: 5_000,
  }).toEqual({
    editorFocused: true,
    contentType: 'heading',
    placeholder: '"Title"',
  })
}

test.describe('Create note crash fix', () => {
  test.beforeEach(() => {
    tempVaultDir = createFixtureVaultCopy()
  })

  test.afterEach(() => {
    removeFixtureVaultCopy(tempVaultDir)
  })

  test('clicking + next to a type section creates a note without crashing @smoke', async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', (err) => errors.push(err.message))

    await openTestVault(page)
    await selectSection(page, 'Projects')
    await createNoteFromListHeader(page)
    await expect(untitledRow(page, 'project')).toBeVisible({ timeout: 5_000 })
    await expectReadyEmptyTitleHeading(page)

    expect(errors).toEqual([])
  })

  test('Cmd+N creates a note without crashing @smoke', async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', (err) => errors.push(err.message))

    await openTestVault(page)
    await page.waitForTimeout(300)
    await page.locator('body').click()
    await sendShortcut(page, 'n', ['Control'])
    await expect(untitledRow(page, 'note')).toBeVisible({ timeout: 5_000 })
    await expectReadyEmptyTitleHeading(page)

    expect(errors).toEqual([])
  })

  test('creating note for custom type does not crash', async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', (err) => errors.push(err.message))

    await openTestVault(page)
    await selectSection(page, 'Events')
    await createNoteFromListHeader(page)
    await expect(untitledRow(page, 'event')).toBeVisible({ timeout: 5_000 })
    await expectReadyEmptyTitleHeading(page)

    expect(errors).toEqual([])
  })

  test('command palette creates typed notes without crashing when a type template is present @smoke', async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', (err) => errors.push(err.message))

    seedTypeEntry(tempVaultDir, 'Procedure', '## Checklist\n\n- first step\n- [[Alpha Project]]\n- unmatched [link')
    await openTestVault(page)

    await openCommandPalette(page)
    await executeCommand(page, 'new procedure')

    await expect(untitledRow(page, 'procedure')).toBeVisible({ timeout: 5_000 })
    await expectReadyEmptyTitleHeading(page)
    expect(errors).toEqual([])
  })
})
