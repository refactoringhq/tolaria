/**
 * Integration tests against a real filesystem vault.
 *
 * Each test copies tests/fixtures/test-vault/ to a temp directory,
 * points the app at it, and verifies real file I/O: creation, rename,
 * wikilink updates, archive/trash filtering, and relationship display.
 */
import { test, expect } from '@playwright/test'
import fs from 'fs'
import path from 'path'
import os from 'os'

const FIXTURE_VAULT = path.resolve('tests/fixtures/test-vault')

function copyDirSync(src: string, dest: string): void {
  fs.mkdirSync(dest, { recursive: true })
  for (const item of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, item.name)
    const d = path.join(dest, item.name)
    if (item.isDirectory()) copyDirSync(s, d)
    else fs.copyFileSync(s, d)
  }
}

let tempVaultDir: string

test.beforeEach(async ({ page }) => {
  // Fresh vault copy for each test
  tempVaultDir = fs.mkdtempSync(path.join(os.tmpdir(), 'laputa-test-vault-'))
  copyDirSync(FIXTURE_VAULT, tempVaultDir)

  // Intercept window.__mockHandlers assignment to override vault path handlers.
  // The Object.defineProperty setter fires when mock-tauri/index.ts sets
  // window.__mockHandlers = mockHandlers, letting us patch the same object
  // reference that mockInvoke reads from.
  await page.addInitScript((vaultPath: string) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let ref: any = null
    Object.defineProperty(window, '__mockHandlers', {
      set(val) {
        ref = val
        ref.load_vault_list = () => ({
          vaults: [{ label: 'Test Vault', path: vaultPath }],
          active_vault: vaultPath,
        })
        ref.check_vault_exists = () => true
        ref.get_last_vault_path = () => vaultPath
        ref.get_default_vault_path = () => vaultPath
        ref.save_vault_list = () => null
      },
      get() { return ref },
      configurable: true,
    })
  }, tempVaultDir)

  await page.goto('/')
  // Wait until the real vault entries are loaded in the sidebar
  await page.getByText('Alpha Project', { exact: true }).first().waitFor({ timeout: 10_000 })
})

test.afterEach(async () => {
  fs.rmSync(tempVaultDir, { recursive: true, force: true })
})

/** Helper: locate the note-list container. */
function noteList(page: import('@playwright/test').Page) {
  return page.locator('[data-testid="note-list-container"]')
}

/** Helper: click a note item by title text in the sidebar. */
async function openNote(page: import('@playwright/test').Page, title: string) {
  await noteList(page).getByText(title, { exact: true }).click()
  await page.waitForTimeout(300)
}

// ---------------------------------------------------------------------------
// 1. Vault loads entries from real fixture files
// ---------------------------------------------------------------------------

test('vault loads entries from fixture files', async ({ page }) => {
  const list = noteList(page)
  await expect(list.getByText('Alpha Project', { exact: true })).toBeVisible()
  await expect(list.getByText('Note B', { exact: true })).toBeVisible()
  await expect(list.getByText('Note C', { exact: true })).toBeVisible()
  await expect(list.getByText('Team Meeting', { exact: true })).toBeVisible()

  // Open a note and verify editor shows its content from disk
  await openNote(page, 'Alpha Project')
  // The WYSIWYG editor renders the title as an H1 heading
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
  // "Create new note" instantly creates "Untitled note" and opens in editor
  await page.locator('button[title="Create new note"]').click()
  await page.waitForTimeout(500)

  // Verify the new note opens — H1 heading should appear in the WYSIWYG editor
  await expect(page.getByRole('heading', { name: /Untitled note/i, level: 1 })).toBeVisible({ timeout: 5_000 })

  // Save to disk via Cmd+S
  await page.keyboard.press('Meta+s')

  // Poll for the file to appear on disk
  const expectedPath = path.join(tempVaultDir, 'note', 'untitled-note.md')
  await expect(async () => {
    expect(fs.existsSync(expectedPath)).toBe(true)
  }).toPass({ timeout: 5_000 })

  const content = fs.readFileSync(expectedPath, 'utf-8')
  expect(content).toContain('# Untitled note')
  expect(content).toContain('type: Note')
})

// ---------------------------------------------------------------------------
// 5. Rename note updates filename on disk
// ---------------------------------------------------------------------------

test('rename note updates filename on disk', async ({ page }) => {
  // Open Note B
  await openNote(page, 'Note B')

  // Double-click the tab title — scope to the draggable tab element to avoid
  // matching the breadcrumb span that also has class "truncate".
  await page.locator('[draggable="true"] span.truncate', { hasText: 'Note B' }).dblclick()
  await page.waitForTimeout(200)

  // In rename mode, draggable becomes false and an <input> appears in the tab.
  // It's the only <input> element on the page at this point.
  const input = page.locator('input').first()
  await expect(input).toBeVisible({ timeout: 2_000 })
  await input.fill('Note B Renamed')
  await input.press('Enter')
  await page.waitForTimeout(500)

  // Verify filesystem: old file gone, new file exists
  const oldPath = path.join(tempVaultDir, 'note', 'note-b.md')
  const newPath = path.join(tempVaultDir, 'note', 'note-b-renamed.md')

  await expect(async () => {
    expect(fs.existsSync(oldPath)).toBe(false)
    expect(fs.existsSync(newPath)).toBe(true)
  }).toPass({ timeout: 5_000 })

  const newContent = fs.readFileSync(newPath, 'utf-8')
  expect(newContent).toContain('# Note B Renamed')
})

// ---------------------------------------------------------------------------
// 6. Wikilink update on rename — other files' [[Note B]] updated
// ---------------------------------------------------------------------------

test('rename note updates wikilinks in other files', async ({ page }) => {
  // Open Note B and rename it
  await openNote(page, 'Note B')

  await page.locator('[draggable="true"] span.truncate', { hasText: 'Note B' }).dblclick()
  await page.waitForTimeout(200)

  const input = page.locator('input').first()
  await expect(input).toBeVisible({ timeout: 2_000 })
  await input.fill('Note B Updated')
  await input.press('Enter')

  // Wait for rename to complete (file to be moved)
  const newPath = path.join(tempVaultDir, 'note', 'note-b-updated.md')
  await expect(async () => {
    expect(fs.existsSync(newPath)).toBe(true)
  }).toPass({ timeout: 5_000 })

  // Verify alpha-project.md now references [[Note B Updated]] instead of [[Note B]]
  const alphaContent = fs.readFileSync(path.join(tempVaultDir, 'project', 'alpha-project.md'), 'utf-8')
  expect(alphaContent).toContain('[[Note B Updated]]')
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
