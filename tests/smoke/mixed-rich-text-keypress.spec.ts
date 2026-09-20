import { test, expect, type Locator, type Page } from '@playwright/test'
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

const NUMBERED_REENTRY_CONTENT = `---
title: Note B
type: Note
status: Active
---

# Note B

Intro paragraph before the list.

1. First numbered item
2. Second numbered item

Plain paragraph after the numbered list.
`

const PROCEDURE_NOTE_CONTENT = `---
title: Procedure
type: Procedure
status: Active
---

# Procedure

Procedures are long-running processes tied to a [[responsibility|Responsibility]].
- Status: Active
- Owner: The person responsible

Plain follow-up paragraph after the procedure checklist.
`

const NESTED_PROCEDURE_NOTE_CONTENT = `---
title: Note B
type: Procedure
status: Active
---

# Note B

Procedures are long-running processes tied to a responsibility.

- Prepare release
  1. Validate nested numbered content
  2. Notify the owner
- Record outcome

Plain follow-up paragraph after the nested procedure checklist.
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
    message.includes('blockContainer node does not contain a blockContent node') ||
    message.includes('RangeError')
  ))).toEqual([])
}

async function loadRawContentInRichEditor(page: Page, content: string) {
  await openNote(page, 'Note B')
  await toggleRawMode(page, '.cm-content')
  await setRawEditorContent(page, content)
  await page.waitForTimeout(700)
  await toggleRawMode(page, '.bn-editor')
}

async function appendMarkerToBlock(page: Page, block: Locator, marker: string) {
  await expect(block).toBeVisible({ timeout: 5_000 })
  await block.click()
  await page.keyboard.press('End')
  await page.keyboard.insertText(` ${marker}`)
  await page.waitForTimeout(900)
}

async function reopenNoteB(page: Page) {
  await openNote(page, 'Note C')
  await openNote(page, 'Note B')
}

async function expectListContentEditableAfterReopen(page: Page, options: {
  content: string
  markerPrefix: string
  primary: {
    selector: string
    text: string
  }
  secondary: {
    selector: string
    text: string
  }
}) {
  const crashSignals = collectEditorCrashSignals(page)
  const markerId = Date.now()
  const primaryMarker = `${options.markerPrefix}-primary-${markerId}`
  const secondaryMarker = `${options.markerPrefix}-secondary-${markerId}`
  const reentryMarker = `${options.markerPrefix}-reentry-${markerId}`

  await loadRawContentInRichEditor(page, options.content)

  const primaryBlock = page.locator(options.primary.selector, {
    hasText: options.primary.text,
  }).first()
  await appendMarkerToBlock(page, primaryBlock, primaryMarker)

  const secondaryBlock = page.locator(options.secondary.selector, {
    hasText: options.secondary.text,
  }).first()
  await appendMarkerToBlock(page, secondaryBlock, secondaryMarker)

  await reopenNoteB(page)
  await appendMarkerToBlock(page, primaryBlock, reentryMarker)

  expectNoBlockContainerCrash(crashSignals)

  await toggleRawMode(page, '.cm-content')
  const raw = await getRawEditorContent(page)
  expect(raw).toContain(primaryMarker)
  expect(raw).toContain(secondaryMarker)
  expect(raw).toContain(reentryMarker)
  expectNoBlockContainerCrash(crashSignals)
}

const listReopenScenarios = [
  {
    name: 'numbered list content stays editable after autosave and re-entry',
    content: NUMBERED_REENTRY_CONTENT,
    markerPrefix: 'numbered',
    primary: {
      selector: '.bn-block-content[data-content-type="numberedListItem"]',
      text: 'First numbered item',
    },
    secondary: {
      selector: '.bn-block-content',
      text: 'Plain paragraph after the numbered list.',
    },
  },
  {
    name: 'nested procedure list content stays editable after save and reopen',
    content: NESTED_PROCEDURE_NOTE_CONTENT,
    markerPrefix: 'nested',
    primary: {
      selector: '.bn-block-content[data-content-type="numberedListItem"]',
      text: 'Validate nested numbered content',
    },
    secondary: {
      selector: '.bn-block-content[data-content-type="bulletListItem"]',
      text: 'Record outcome',
    },
  },
] as const

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
  await page.keyboard.press('End')
  await page.keyboard.insertText(' 추가')
  await bulletBlock.hover()
  await expect(page.locator('.bn-side-menu').first()).toBeVisible({ timeout: 5_000 })
  await page.locator('.bn-side-menu').first().click({ force: true })
  await page.keyboard.press('Escape')
  await bulletBlock.click()
  await page.keyboard.press('End')
  await page.keyboard.insertText(' 계속')
  await page.waitForTimeout(700)

  expectNoBlockContainerCrash(crashSignals)

  await toggleRawMode(page, '.cm-content')
  const raw = await getRawEditorContent(page)
  expect(raw).toContain('> 인용문 추가')
  expect(raw).toContain('- 첫 번째 항목 계속')
  expectNoBlockContainerCrash(crashSignals)
})

for (const scenario of listReopenScenarios) {
  test(scenario.name, async ({ page }) => {
    await expectListContentEditableAfterReopen(page, scenario)
  })
}

test('Procedure prose and adjacent bullet-list content stay editable through keydown edits', async ({ page }) => {
  const crashSignals = collectEditorCrashSignals(page)
  const markerId = Date.now()
  const paragraphMarker = `procedure-paragraph-${markerId}`
  const ownerMarker = `procedure-owner-${markerId}`
  const cadenceMarker = `procedure-cadence-${markerId}`

  await openNote(page, 'Note B')
  await toggleRawMode(page, '.cm-content')
  await setRawEditorContent(page, PROCEDURE_NOTE_CONTENT)
  await page.waitForTimeout(700)
  await toggleRawMode(page, '.bn-editor')

  const procedureParagraph = page.locator('.bn-block-content', {
    hasText: 'Procedures are long-running processes',
  }).first()
  await expect(procedureParagraph).toBeVisible({ timeout: 5_000 })
  await procedureParagraph.click()
  await page.keyboard.press('End')
  await page.keyboard.insertText(` ${paragraphMarker}`)
  await page.waitForTimeout(700)

  const ownerItem = page.locator('.bn-block-content[data-content-type="bulletListItem"]', {
    hasText: 'Owner: The person responsible',
  }).first()
  await expect(ownerItem).toBeVisible({ timeout: 5_000 })
  await ownerItem.click()
  await page.keyboard.press('End')
  await page.keyboard.insertText(` ${ownerMarker}`)
  await page.keyboard.press('Enter')
  await page.keyboard.insertText(`Cadence: Weekly ${cadenceMarker}`)
  await page.waitForTimeout(900)

  expectNoBlockContainerCrash(crashSignals)

  await toggleRawMode(page, '.cm-content')
  const raw = await getRawEditorContent(page)
  expect(raw).toContain(paragraphMarker)
  expect(raw).toContain(`- Owner: The person responsible ${ownerMarker}`)
  expect(raw).toContain(`- Cadence: Weekly ${cadenceMarker}`)
  expectNoBlockContainerCrash(crashSignals)
})
