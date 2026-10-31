import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  createAttachmentCleanup,
  noteAttachmentReferences,
  vaultRootForNote,
  type AttachmentCleanupDependencies,
} from './attachmentCleanup'

const VAULT = '/vault'
const NOTE = '/vault/note.md'
const PHOTO = '![photo](attachments/photo.png)'
const REPORT = '[report.pdf](attachments/report.pdf)'

function setup(overrides: Partial<AttachmentCleanupDependencies> = {}) {
  const invokeCommand = vi.fn(async (command: string) => {
    if (command === 'remove_unreferenced_attachment') {
      return { removed: true, backupPath: '/tmp/backup/photo.png' }
    }
    return '/vault/attachments/photo.png'
  })
  const track = vi.fn()
  const cleanup = createAttachmentCleanup({
    delayMs: 1000,
    enabled: () => true,
    invokeCommand: invokeCommand as AttachmentCleanupDependencies['invokeCommand'],
    readCachedContent: () => null,
    track,
    ...overrides,
  })
  return { cleanup, invokeCommand, track }
}

function persist(cleanup: ReturnType<typeof setup>['cleanup'], content: string) {
  cleanup.handlePersisted({ path: NOTE, content, vaultPath: VAULT })
}

describe('noteAttachmentReferences', () => {
  it('collects portable attachment links, images, angle destinations and HTML sources', () => {
    const content = [
      '![shot](attachments/Meeting Snapshot.png "Title")',
      '[brief](<attachments/project brief.pdf>)',
      '![encoded](./attachments/team%20sync.png)',
      '<img src="/attachments/inline.svg">',
      '[site](https://example.com/attachments/remote.png)',
      '![escape](attachments/../secret.png)',
    ].join('\n')

    expect([...noteAttachmentReferences(content)].sort()).toEqual([
      'attachments/Meeting Snapshot.png',
      'attachments/inline.svg',
      'attachments/project brief.pdf',
      'attachments/team sync.png',
    ])
  })

  it('returns an empty set when nothing references attachments', () => {
    expect(noteAttachmentReferences('# Plain note\n\n[link](https://example.com)').size).toBe(0)
  })
})

describe('vaultRootForNote', () => {
  it('picks the deepest matching vault root and ignores empty roots', () => {
    expect(vaultRootForNote('/a/b/note.md', ['', '/a', '/a/b'])).toBe('/a/b')
    expect(vaultRootForNote('/a/note.md', '/a')).toBe('/a')
    expect(vaultRootForNote('/other/note.md', ['/a'])).toBeNull()
    expect(vaultRootForNote('/a/note.md', '')).toBeNull()
  })
})

describe('createAttachmentCleanup', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('removes an attachment after its last reference is saved away', async () => {
    const { cleanup, invokeCommand, track } = setup()
    persist(cleanup, `${PHOTO}\n${REPORT}`)
    persist(cleanup, REPORT)

    expect(invokeCommand).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(1000)

    expect(invokeCommand).toHaveBeenCalledTimes(1)
    expect(invokeCommand).toHaveBeenCalledWith('remove_unreferenced_attachment', {
      attachmentPath: 'attachments/photo.png',
      vaultPath: VAULT,
    })
    expect(track).toHaveBeenCalledWith('attachment_removed')
  })

  it('seeds the previous references from the cached note content', async () => {
    const { cleanup, invokeCommand } = setup({ readCachedContent: () => PHOTO })
    cleanup.rememberBeforePersist(NOTE)
    persist(cleanup, '# Empty')
    await vi.advanceTimersByTimeAsync(1000)

    expect(invokeCommand).toHaveBeenCalledWith('remove_unreferenced_attachment', expect.anything())
  })

  it('does nothing on the first save when no previous content is known', async () => {
    const { cleanup, invokeCommand } = setup()
    cleanup.rememberBeforePersist(NOTE)
    persist(cleanup, '# Empty')
    await vi.advanceTimersByTimeAsync(1000)

    expect(invokeCommand).not.toHaveBeenCalled()
  })

  it('cancels a pending removal when an edit references the attachment again', async () => {
    const { cleanup, invokeCommand } = setup()
    persist(cleanup, PHOTO)
    persist(cleanup, '# Empty')
    cleanup.handleContentChanged({ path: NOTE, content: PHOTO, vaultPath: VAULT })
    await vi.advanceTimersByTimeAsync(1000)

    expect(invokeCommand).not.toHaveBeenCalled()
  })

  it('restores a removed attachment when a later save references it again', async () => {
    const { cleanup, invokeCommand, track } = setup()
    persist(cleanup, PHOTO)
    persist(cleanup, '# Empty')
    await vi.advanceTimersByTimeAsync(1000)
    persist(cleanup, PHOTO)
    await vi.runAllTimersAsync()

    expect(invokeCommand).toHaveBeenLastCalledWith('restore_removed_attachment', {
      attachmentPath: 'attachments/photo.png',
      backupPath: '/tmp/backup/photo.png',
      vaultPath: VAULT,
    })
    expect(track).toHaveBeenCalledWith('attachment_restored')
  })

  it('keeps the file when the native scan still finds another reference', async () => {
    const invokeCommand = vi.fn(async () => ({ removed: false, backupPath: null }))
    const { cleanup, track } = setup({
      invokeCommand: invokeCommand as AttachmentCleanupDependencies['invokeCommand'],
    })
    persist(cleanup, PHOTO)
    persist(cleanup, '# Empty')
    await vi.advanceTimersByTimeAsync(1000)
    persist(cleanup, PHOTO)
    await vi.runAllTimersAsync()

    expect(invokeCommand).toHaveBeenCalledTimes(1)
    expect(track).not.toHaveBeenCalled()
  })

  it('logs and continues when the native commands fail', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const invokeCommand = vi.fn(async () => {
      throw new Error('boom')
    })
    const { cleanup } = setup({
      invokeCommand: invokeCommand as AttachmentCleanupDependencies['invokeCommand'],
    })
    persist(cleanup, PHOTO)
    persist(cleanup, '# Empty')
    await vi.advanceTimersByTimeAsync(1000)

    expect(warn).toHaveBeenCalledWith('[attachment] Failed to remove unreferenced attachment:', expect.any(Error))
    warn.mockRestore()
  })

  it('logs a failed restore', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const invokeCommand = vi.fn(async (command: string) => {
      if (command === 'restore_removed_attachment') throw new Error('exists')
      return { removed: true, backupPath: '/tmp/backup/photo.png' }
    })
    const { cleanup } = setup({
      invokeCommand: invokeCommand as AttachmentCleanupDependencies['invokeCommand'],
    })
    persist(cleanup, PHOTO)
    persist(cleanup, '# Empty')
    await vi.advanceTimersByTimeAsync(1000)
    cleanup.handleContentChanged({ path: NOTE, content: PHOTO, vaultPath: VAULT })
    await vi.runAllTimersAsync()

    expect(warn).toHaveBeenCalledWith('[attachment] Failed to restore removed attachment:', expect.any(Error))
    warn.mockRestore()
  })

  it('stays inactive outside the desktop runtime', async () => {
    const { cleanup, invokeCommand } = setup({ enabled: () => false })
    persist(cleanup, PHOTO)
    persist(cleanup, '# Empty')
    await vi.advanceTimersByTimeAsync(1000)

    expect(invokeCommand).not.toHaveBeenCalled()
  })
})
