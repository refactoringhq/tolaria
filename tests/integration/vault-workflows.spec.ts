/**
 * Integration tests against a real filesystem vault.
 *
 * Each test copies tests/fixtures/test-vault/ to a temp directory,
 * points the app at it, and verifies real file I/O: creation, rename,
 * wikilink updates, archive/trash filtering, and relationship display.
 */
import { expect, type Page, test } from '@playwright/test'

import fs from 'fs'
import path from 'path'
import { createFixtureVaultCopy, openFixtureVault, removeFixtureVaultCopy } from '../helpers/fixtureVault'

let tempVaultDir: string

test.beforeEach(async ({ page }, testInfo) => {
  testInfo.setTimeout(60_000)
  tempVaultDir = createFixtureVaultCopy()
  await openFixtureVault(page, tempVaultDir)
})

test.afterEach(async () => {
  removeFixtureVaultCopy(tempVaultDir)
})

/** Helper: locate the note-list container. */
function noteList(page: Page) {
  return page.locator('[data-testid="note-list-container"]')
}

/** Helper: click a note item by title text in the sidebar. */
async function openNote(page: Page, title: string) {
  await noteList(page).getByText(title, { exact: true }).click()
  await page.waitForTimeout(300)
}

/** Helper: rename the active note filename through the breadcrumb control. */
async function renameActiveNoteFilename(page: Page, nextFilename: string) {
  await page.getByTestId('breadcrumb-filename-trigger').dblclick()
  const filenameInput = page.getByTestId('breadcrumb-filename-input')
  await expect(filenameInput).toBeVisible({ timeout: 5_000 })
  await filenameInput.fill(nextFilename)
  await filenameInput.press('Enter')
  await expect(page.getByTestId('breadcrumb-filename-trigger')).toContainText(nextFilename, { timeout: 5_000 })
}

// ---------------------------------------------------------------------------
// 1. Vault loads entries from real fixture files
// ---------------------------------------------------------------------------

test('vault loads entries from fixture files @smoke', async ({ page }) => {
  const list = noteList(page)
  await expect(list.getByText('Alpha Project', { exact: true })).toBeVisible()
  await expect(list.getByText('Note B', { exact: true })).toBeVisible()
  await expect(list.getByText('Note C', { exact: true })).toBeVisible()
  await expect(list.getByText('Team Meeting', { exact: true })).toBeVisible()

  // Open a note and verify editor shows its content from disk
  await openNote(page, 'Alpha Project')
  await expect(page.getByRole('heading', { name: 'Alpha Project', level: 1 })).toBeVisible({ timeout: 5_000 })
})

// ---------------------------------------------------------------------------
// 2. Archived note hidden from main sidebar
// ---------------------------------------------------------------------------

test('archived note does not appear in All Notes', async ({ page }) => {
  const list = noteList(page)
  // "Archived Note" has Archived: Yes — should be hidden from default view
  await expect(list.getByText('Archived Note', { exact: true })).not.toBeVisible()

  // But regular notes are visible
  await expect(list.getByText('Note B', { exact: true })).toBeVisible()
})

// ---------------------------------------------------------------------------
// 3. Trashed note hidden from note list
// ---------------------------------------------------------------------------

test('trashed note does not appear in All Notes', async ({ page }) => {
  const list = noteList(page)
  // "Trashed Note" has Trashed: true — should be hidden
  await expect(list.getByText('Trashed Note', { exact: true })).not.toBeVisible()

  // Regular notes are visible
  await expect(list.getByText('Note C', { exact: true })).toBeVisible()
})

// ---------------------------------------------------------------------------
// 4. Create note saves file to disk with correct slug
// ---------------------------------------------------------------------------

test('create note saves file to disk with correct slug', async ({ page }) => {
  const beforeFiles = new Set(fs.readdirSync(tempVaultDir))

  // "Create new note" instantly creates "Untitled note" and opens in editor
  await page.locator('button[title="Create new note"]').click()
  await expect(noteList(page).getByText(/Untitled Note \d+/).first()).toBeVisible({ timeout: 5_000 })

  // Save to disk via Cmd+S
  await page.keyboard.press('Meta+s')

  // Poll for the new timestamp-based file to appear on disk.
  await expect(async () => {
    const afterFiles = fs.readdirSync(tempVaultDir)
    const createdFiles = afterFiles.filter(name => !beforeFiles.has(name) && /^untitled-note-\d+\.md$/.test(name))
    expect(createdFiles).toHaveLength(1)
  }).toPass({ timeout: 5_000 })

  const createdFile = fs.readdirSync(tempVaultDir).find(name => !beforeFiles.has(name) && /^untitled-note-\d+\.md$/.test(name))
  expect(createdFile).toBeTruthy()

  const content = fs.readFileSync(path.join(tempVaultDir, createdFile!), 'utf-8')
  expect(content).not.toContain('# Untitled note')
  expect(content).toContain('type: Note')
})

// ---------------------------------------------------------------------------
// 5. Rename note updates filename on disk
// ---------------------------------------------------------------------------

test('rename note updates filename on disk', async ({ page }) => {
  // Open Note B
  await openNote(page, 'Note B')

  await renameActiveNoteFilename(page, 'note-b-renamed')

  // Verify filesystem: old file gone, new file exists
  const oldPath = path.join(tempVaultDir, 'note', 'note-b.md')
  const newPath = path.join(tempVaultDir, 'note', 'note-b-renamed.md')

  await expect(async () => {
    expect(fs.existsSync(oldPath)).toBe(false)
    expect(fs.existsSync(newPath)).toBe(true)
  }).toPass({ timeout: 5_000 })

  const newContent = fs.readFileSync(newPath, 'utf-8')
  expect(newContent).toContain('# Note B')
})

// ---------------------------------------------------------------------------
// 6. Wikilink update on rename — other files' [[Note B]] updated
// ---------------------------------------------------------------------------

test('rename note updates wikilinks in other files', async ({ page }) => {
  // Open Note B and rename it
  await openNote(page, 'Note B')
  await renameActiveNoteFilename(page, 'note-b-updated')

  // Wait for rename to complete (file to be moved)
  const newPath = path.join(tempVaultDir, 'note', 'note-b-updated.md')
  await expect(async () => {
    expect(fs.existsSync(newPath)).toBe(true)
  }).toPass({ timeout: 5_000 })

  // Verify alpha-project.md now references the canonical path target.
  const alphaContent = fs.readFileSync(path.join(tempVaultDir, 'project', 'alpha-project.md'), 'utf-8')
  expect(alphaContent).toContain('[[note/note-b-updated]]')
  expect(alphaContent).not.toContain('[[note/note-b]]')
  expect(alphaContent).not.toContain('[[Note B]]')
})

// ---------------------------------------------------------------------------
// 7. Relationship display in inspector
// ---------------------------------------------------------------------------

test('inspector shows relationships for note with wikilink fields', async ({ page }) => {
  // Open Note C which has Related to: [[Alpha Project]] and Topics: [[design]]
  await openNote(page, 'Note C')

  // The DynamicRelationshipsPanel renders field labels like "Related to", "Topics"
  // as <span> elements. Verify that the relationship labels are visible in the inspector.
  await expect(page.getByText('Related to').first()).toBeVisible({ timeout: 5_000 })
})

// ---------------------------------------------------------------------------
// 8. Opening a note loads real file content from disk
// ---------------------------------------------------------------------------

test('editor shows real file content from disk', async ({ page }) => {
  // Open Team Meeting
  await openNote(page, 'Team Meeting')

  // Verify editor shows the actual file content — H1 heading from the file
  await expect(page.getByRole('heading', { name: 'Team Meeting', level: 1 })).toBeVisible({ timeout: 5_000 })
})
