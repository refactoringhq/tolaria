import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createHarness, type Harness, settle } from './collabHelpers.ts'

// A live note on a server that pushes in the background (TOL-424): its edits are saved and
// acknowledged before the git remote hears of them, so a desktop push of the same lines is
// only met when that push is integrated, after the save.

const NOTE = 'plan.md'
const LONG_NOTE = '---\ntype: Note\n---\n\n# Plan\n\nFirst paragraph.\n\nSecond paragraph.\n\nThird paragraph.\n'
const WEB_VERSION = LONG_NOTE.replace('Second paragraph.', 'Second paragraph. Web version.')
const DESKTOP_VERSION = LONG_NOTE.replace('Second paragraph.', 'Second paragraph. Desktop version.')

let harness: Harness

beforeEach(async () => {
  // The push waits for its debounce, so nothing reaches the remote before the desktop pushes.
  harness = await createHarness({ vault: { pushDebounceMs: 60_000, fetchIntervalMs: 0 } })
  await harness.fixture.desktop.commit(NOTE, LONG_NOTE)
  await harness.vault.syncNow()
})

afterEach(async () => {
  await harness.cleanup()
})

describe('a desktop push that crosses a saved live edit', () => {
  it('keeps the saved edit at the path and tells editors the desktop version is a conflict copy', async () => {
    const ada = await harness.client(NOTE)
    ada.type('Second', ' Web version.')
    await settle()
    expect(await (await harness.session(NOTE)).flush()).toBe('written')

    await harness.fixture.desktop.commit(NOTE, DESKTOP_VERSION)
    await harness.vault.syncNow()
    await (await harness.session(NOTE)).settled()
    await settle()

    const copy = ada.doc.getMap<string>('meta').get('conflictCopy') as string
    expect(copy).toMatch(/^plan \(conflict .+\)\.md$/)
    expect(await harness.fixture.desktop.read(NOTE)).toBe(WEB_VERSION)
    expect(await harness.fixture.desktop.read(copy)).toBe(DESKTOP_VERSION)
    expect(ada.markdown()).toContain('Second paragraph. Web version.')
    expect(ada.markdown()).not.toContain('Desktop version.')
  })

  it('does not tell editors of the same copy again when a later desktop push arrives', async () => {
    const ada = await harness.client(NOTE)
    ada.type('Second', ' Web version.')
    await settle()
    await (await harness.session(NOTE)).flush()
    await harness.fixture.desktop.commit(NOTE, DESKTOP_VERSION)
    await harness.vault.syncNow()
    await (await harness.session(NOTE)).settled()

    await harness.fixture.desktop.commit('later.md', '# Later\n')
    expect(await harness.vault.syncNow()).toMatchObject({ pulled: true })
    await settle()

    expect(harness.logs.filter((line) => line.includes('changed on both sides'))).toHaveLength(1)
  })
})
