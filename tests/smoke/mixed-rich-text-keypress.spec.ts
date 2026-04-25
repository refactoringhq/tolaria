import { test, expect, type Page } from '@playwright/test'
import { createFixtureVaultCopy, openFixtureVault, removeFixtureVaultCopy } from '../helpers/fixtureVault'
import { executeCommand, openCommandPalette } from './helpers'

const MIXED_RICH_TEXT_CONTENT = `---
title: Note B
type: Note
status: Active
---

# Note B

> 인용문

## 섹션

- 첫 번째 항목
- 두 번째 항목

Plain paragraph after the list.
`

let tempVaultDir: string

test.beforeEach(async ({ page }, testInfo) => {
  testInfo.setTimeout(90_000)
  tempVaultDir = createFixtureVaultCopy()
  await openFixtureVault(page, tempVaultDir)
})

test.afterEach(async () => {
  removeFixtureVaultCopy(tempVaultDir)
})

async function openNote(page: Page, title: string) {
  await page.locator('[data-testid="note-list-container"]').getByText(title, { exact: true }).click()
  await expect(page.locator('.bn-editor')).toBeVisible({ timeout: 5_000 })
}

async function toggleRawMode(page: Page, visibleSelector: string) {
  await openCommandPalette(page)
  await executeCommand(page, 'Toggle Raw')
  await expect(page.locator(visibleSelector)).toBeVisible({ timeout: 5_000 })
}

async function getRawEditorContent(page: Page): Promise<string> {
  return page.evaluate(() => {
    type CodeMirrorHost = Element & {
      cmTile?: {
        view?: {
          state: {
            doc: {
              toString(): string
            }
          }
        }
      }
    }

    const el = document.querySelector('.cm-content')
    const view = (el as CodeMirrorHost | null)?.cmTile?.view
    return view?.state.doc.toString() ?? el?.textContent ?? ''
  })
}

async function setRawEditorContent(page: Page, content: string) {
  await page.evaluate((nextContent) => {
    type CodeMirrorHost = Element & {
      cmTile?: {
        view?: {
          state: {
            doc: {
              length: number
            }
          }
          dispatch(update: { changes: { from: number; to: number; insert: string } }): void
        }
      }
    }

    const el = document.querySelector('.cm-content')
    const view = (el as CodeMirrorHost | null)?.cmTile?.view
    if (!view) throw new Error('CodeMirror view not found')
    view.dispatch({
      changes: { from: 0, to: view.state.doc.length, insert: nextContent },
    })
  }, content)
}

function collectEditorCrashSignals(page: Page) {
  const messages: string[] = []

  page.on('pageerror', (error) => {
    messages.push(error.message)
  })

  page.on('console', (message) => {
    if (message.type() === 'error') {
      messages.push(message.text())
    }
  })

  return messages
}

function expectNoBlockContainerCrash(messages: string[]) {
  expect(messages.filter((message) => (
    message.includes('Invalid content for node blockContainer') ||
    message.includes('RangeError')
  ))).toEqual([])
}

test('mixed rich-text blocks with Korean list content stay editable after action clicks', async ({ page }) => {
  const crashSignals = collectEditorCrashSignals(page)

  await openNote(page, 'Note B')
  await toggleRawMode(page, '.cm-content')
  await setRawEditorContent(page, MIXED_RICH_TEXT_CONTENT)
  await page.waitForTimeout(700)
  await toggleRawMode(page, '.bn-editor')

  const bulletBlock = page.locator('.bn-block-content', { hasText: '첫 번째 항목' }).first()
  await expect(bulletBlock).toBeVisible({ timeout: 5_000 })

  await page.locator('.bn-block-content', { hasText: '인용문' }).first().click()
  await page.keyboard.insertText(' 추가')
  await bulletBlock.hover()
  await expect(page.locator('.bn-side-menu').first()).toBeVisible({ timeout: 5_000 })
  await page.locator('.bn-side-menu').first().click({ force: true })
  await page.keyboard.press('Escape')
  await bulletBlock.click()
  await page.keyboard.insertText(' 계속')
  await page.waitForTimeout(700)

  expectNoBlockContainerCrash(crashSignals)

  await toggleRawMode(page, '.cm-content')
  const raw = await getRawEditorContent(page)
  expect(raw).toContain('> 인용문 추가')
  expect(raw).toContain('- 첫 번째 항목 계속')
  expectNoBlockContainerCrash(crashSignals)
})
