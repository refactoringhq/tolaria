import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { FilePreview } from './FilePreview'
import type { VaultEntry } from '../types'

vi.mock('@tauri-apps/api/core', () => ({
  convertFileSrc: (path: string) => `asset://${path}`,
}))

const imageEntry: VaultEntry = {
  path: '/vault/Attachments/photo.png',
  filename: 'photo.png',
  title: 'photo.png',
  isA: null,
  aliases: [],
  belongsTo: [],
  relatedTo: [],
  status: null,
  archived: false,
  modifiedAt: 1700000000,
  createdAt: 1700000000,
  fileSize: 100,
  snippet: '',
  wordCount: 0,
  relationships: {},
  icon: null,
  color: null,
  order: null,
  sidebarLabel: null,
  template: null,
  sort: null,
  view: null,
  visible: null,
  organized: false,
  favorite: false,
  favoriteIndex: null,
  listPropertiesDisplay: [],
  outgoingLinks: [],
  properties: {},
  hasH1: false,
  fileKind: 'binary',
}

describe('FilePreview', () => {
  it('routes header file actions to the active file path', () => {
    const onRevealFile = vi.fn()
    const onCopyFilePath = vi.fn()
    const onOpenExternalFile = vi.fn()

    render(
      <FilePreview
        entry={imageEntry}
        onRevealFile={onRevealFile}
        onCopyFilePath={onCopyFilePath}
        onOpenExternalFile={onOpenExternalFile}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Reveal' }))
    fireEvent.click(screen.getByRole('button', { name: 'Copy path' }))
    fireEvent.click(screen.getByRole('button', { name: 'Open' }))

    expect(onRevealFile).toHaveBeenCalledWith('/vault/Attachments/photo.png')
    expect(onCopyFilePath).toHaveBeenCalledWith('/vault/Attachments/photo.png')
    expect(onOpenExternalFile).toHaveBeenCalledWith('/vault/Attachments/photo.png')
  })
})
