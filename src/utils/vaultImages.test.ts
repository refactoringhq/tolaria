import { describe, it, expect, vi } from 'vitest'
import { resolveImageUrls, portableImageUrls } from './vaultImages'

let tauriMode = false

vi.mock('@tauri-apps/api/core', () => ({
  convertFileSrc: vi.fn((path: string) => `asset://localhost/${encodeURIComponent(path)}`),
}))

vi.mock('../mock-tauri', () => ({
  isTauri: () => tauriMode,
}))

function assetUrl(path: string): string {
  return `asset://localhost/${encodeURIComponent(path)}`
}

function httpAssetUrl(path: string): string {
  return `http://asset.localhost/${encodeURIComponent(path)}`
}

describe('resolveImageUrls', () => {
  it('is a no-op outside Tauri', () => {
    tauriMode = false
    const markdown = '![alt](attachments/file.png)'

    expect(resolveImageUrls(markdown, '/vault')).toBe(markdown)
  })

  it('is a no-op when vaultPath is empty', () => {
    tauriMode = true
    const markdown = '![alt](attachments/file.png)'

    expect(resolveImageUrls(markdown, '')).toBe(markdown)
  })

  it('converts relative attachment paths to asset URLs', () => {
    tauriMode = true
    const markdown = '![screenshot](attachments/1776369786040-CleanShot_2026-04-16.png)'

    expect(resolveImageUrls(markdown, '/vault')).toBe(
      `![screenshot](${assetUrl('/vault/attachments/1776369786040-CleanShot_2026-04-16.png')})`,
    )
  })

  it('decodes URL-encoded chars in relative attachment paths', () => {
    tauriMode = true
    const markdown = '![pic](attachments/sub/IMAGE%202022-10-15%2015%3A47%3A07.jpg)'

    expect(resolveImageUrls(markdown, '/vault')).toBe(
      `![pic](${assetUrl('/vault/attachments/sub/IMAGE 2022-10-15 15:47:07.jpg')})`,
    )
  })

  it('leaves already-correct asset URLs unchanged', () => {
    tauriMode = true
    const url = assetUrl('/vault/attachments/file.png')
    const markdown = `![alt](${url})`

    expect(resolveImageUrls(markdown, '/vault')).toBe(markdown)
  })

  it('rewrites legacy asset URLs from a different vault', () => {
    tauriMode = true
    const legacyUrl = assetUrl('/Users/luca/Workspace/tolaria-getting-started/attachments/CleanShot.png')
    const markdown = `![CleanShot](${legacyUrl})`

    expect(resolveImageUrls(markdown, '/Users/john/Documents/Getting Started')).toBe(
      `![CleanShot](${assetUrl('/Users/john/Documents/Getting Started/attachments/CleanShot.png')})`,
    )
  })

  it('leaves already-correct http asset URLs unchanged', () => {
    tauriMode = true
    const url = httpAssetUrl('/vault/attachments/file.png')
    const markdown = `![alt](${url})`

    expect(resolveImageUrls(markdown, '/vault')).toBe(markdown)
  })

  it('leaves external URLs unchanged', () => {
    tauriMode = true
    const httpImage = '![logo](https://example.com/logo.png)'
    const dataImage = '![icon](data:image/png;base64,abc123)'

    expect(resolveImageUrls(httpImage, '/vault')).toBe(httpImage)
    expect(resolveImageUrls(dataImage, '/vault')).toBe(dataImage)
  })

  it('handles multiple images in one document', () => {
    tauriMode = true
    const markdown = `![a](${assetUrl('/old/attachments/a.png')})\n\n![b](attachments/b.png)`

    const result = resolveImageUrls(markdown, '/vault')

    expect(result).toContain(`![a](${assetUrl('/vault/attachments/a.png')})`)
    expect(result).toContain(`![b](${assetUrl('/vault/attachments/b.png')})`)
  })

  it('preserves alt text and title attributes', () => {
    tauriMode = true
    const markdown = '![my screenshot](attachments/file.png "starter vault")'

    expect(resolveImageUrls(markdown, '/vault')).toBe(
      `![my screenshot](${assetUrl('/vault/attachments/file.png')} "starter vault")`,
    )
  })

  it('skips unknown asset URLs without an attachments segment', () => {
    tauriMode = true
    const url = httpAssetUrl('/some/other/path/file.png')
    const markdown = `![alt](${url})`

    expect(resolveImageUrls(markdown, '/vault')).toBe(markdown)
  })

  it('resolves ../-prefixed attachment paths against the note path', () => {
    tauriMode = true
    const notePath = '/vault/self+psy/apeiron/seminars/skazkoterapiya.md'
    const markdown =
      '![BlockNote image](../../../attachments/skazkoterapiya/IMAGE%202022-10-15%2015%3A47%3A07.jpg)'

    expect(resolveImageUrls(markdown, '/vault', notePath)).toBe(
      `![BlockNote image](${assetUrl('/vault/attachments/skazkoterapiya/IMAGE 2022-10-15 15:47:07.jpg')})`,
    )
  })

  it('resolves ./-prefixed attachment paths against the note path', () => {
    tauriMode = true
    const notePath = '/vault/attachments/topic/note.md'
    const markdown = '![pic](./image.png)'

    expect(resolveImageUrls(markdown, '/vault', notePath)).toBe(
      `![pic](${assetUrl('/vault/attachments/topic/image.png')})`,
    )
  })

  it('leaves ../-prefixed paths that escape the vault unchanged', () => {
    tauriMode = true
    const notePath = '/vault/note.md'
    const markdown = '![leak](../../../../etc/passwd)'

    expect(resolveImageUrls(markdown, '/vault', notePath)).toBe(markdown)
  })

  it('leaves ../-prefixed paths that resolve outside the attachments folder unchanged', () => {
    tauriMode = true
    const notePath = '/vault/a/b/c.md'
    const markdown = '![sibling](../other.md)'

    expect(resolveImageUrls(markdown, '/vault', notePath)).toBe(markdown)
  })

  it('leaves ../-prefixed paths unchanged when notePath is not provided', () => {
    tauriMode = true
    const markdown = '![x](../../../attachments/file.png)'

    expect(resolveImageUrls(markdown, '/vault')).toBe(markdown)
  })

  it('resolves leading-slash /attachments/ paths as vault-root-absolute', () => {
    tauriMode = true
    const markdown =
      '![BlockNote image](/attachments/skazkoterapiya/IMAGE%202022-10-15%2015%3A47%3A07.jpg)'

    expect(resolveImageUrls(markdown, '/vault')).toBe(
      `![BlockNote image](${assetUrl('/vault/attachments/skazkoterapiya/IMAGE 2022-10-15 15:47:07.jpg')})`,
    )
  })

  it('leaves other leading-slash paths unchanged', () => {
    tauriMode = true
    const markdown = '![etc](/etc/passwd)'

    expect(resolveImageUrls(markdown, '/vault')).toBe(markdown)
  })
})

describe('portableImageUrls', () => {
  it('converts vault attachment asset URLs to relative paths', () => {
    const url = assetUrl('/vault/attachments/1776369786040-CleanShot.png')
    const markdown = `![screenshot](${url})`

    expect(portableImageUrls(markdown, '/vault')).toBe(
      '![screenshot](attachments/1776369786040-CleanShot.png)',
    )
  })

  it('converts legacy asset protocol attachment URLs to relative paths', () => {
    const url = httpAssetUrl('/vault/attachments/legacy.png')
    const markdown = `![screenshot](${url})`

    expect(portableImageUrls(markdown, '/vault')).toBe(
      '![screenshot](attachments/legacy.png)',
    )
  })

  it('is a no-op when vaultPath is empty', () => {
    const url = assetUrl('/vault/attachments/file.png')
    const markdown = `![alt](${url})`

    expect(portableImageUrls(markdown, '')).toBe(markdown)
  })

  it('leaves asset URLs from other vaults unchanged', () => {
    const url = assetUrl('/other-vault/attachments/file.png')
    const markdown = `![alt](${url})`

    expect(portableImageUrls(markdown, '/vault')).toBe(markdown)
  })

  it('leaves relative and external paths unchanged', () => {
    const relativeImage = '![alt](attachments/file.png)'
    const httpImage = '![logo](https://example.com/logo.png)'

    expect(portableImageUrls(relativeImage, '/vault')).toBe(relativeImage)
    expect(portableImageUrls(httpImage, '/vault')).toBe(httpImage)
  })

  it('handles multiple images', () => {
    const markdown = `![a](${assetUrl('/vault/attachments/a.png')})\n\n![b](${assetUrl('/vault/attachments/b.png')})`

    const result = portableImageUrls(markdown, '/vault')

    expect(result).toContain('![a](attachments/a.png)')
    expect(result).toContain('![b](attachments/b.png)')
  })

  it('preserves title attributes when converting to portable paths', () => {
    const markdown = `![shot](${assetUrl('/vault/attachments/a.png')} "starter vault")`

    expect(portableImageUrls(markdown, '/vault')).toBe('![shot](attachments/a.png "starter vault")')
  })
})

describe('resolveImageUrls / portableImageUrls round-trip', () => {
  it('keeps relative attachment markdown stable', () => {
    tauriMode = true
    const markdown = '![shot](attachments/file.png)'

    expect(portableImageUrls(resolveImageUrls(markdown, '/vault'), '/vault')).toBe(markdown)
  })
})
