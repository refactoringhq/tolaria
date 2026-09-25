import { createRef } from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { FolderContextMenu, type FolderContextMenuState } from './FolderContextMenu'

function setViewportSize(width: number, height: number) {
  Object.defineProperty(window, 'innerWidth', { value: width, configurable: true })
  Object.defineProperty(window, 'innerHeight', { value: height, configurable: true })
}

function renderFolderContextMenu(menu: FolderContextMenuState) {
  render(
    <FolderContextMenu
      menu={menu}
      menuRef={createRef<HTMLDivElement>()}
      onCopyPath={vi.fn()}
      onDelete={vi.fn()}
      onRename={vi.fn()}
      onReveal={vi.fn()}
    />,
  )
}

describe('FolderContextMenu', () => {
  it('keeps the menu visible near the bottom-right viewport edge', () => {
    setViewportSize(320, 180)
    renderFolderContextMenu({ path: 'projects', x: 312, y: 176 })

    const menu = screen.getByTestId('folder-context-menu')
    expect(menu.style.left).toBe('')
    expect(menu.style.top).toBe('')
    expect(menu).toHaveStyle({
      bottom: '8px',
      maxHeight: '164px',
      right: '8px',
    })
  })

  it('retains bounded folder menu width through the shared positioning helper', () => {
    setViewportSize(1024, 768)
    renderFolderContextMenu({ path: 'projects', x: 40, y: 64 })

    const menu = screen.getByTestId('folder-context-menu')
    expect(menu).toHaveStyle({
      maxWidth: 'min(22rem, calc(100vw - 16px))',
      minWidth: 'min(11.25rem, calc(100vw - 16px))',
      overflowY: 'auto',
    })
  })

  it('passes the mounted folder rootPath to delete', () => {
    const onDelete = vi.fn()
    render(
      <FolderContextMenu
        menu={{ path: 'projects', rootPath: '/Users/luca/Team', x: 40, y: 64 }}
        menuRef={createRef<HTMLDivElement>()}
        onCopyPath={vi.fn()}
        onDelete={onDelete}
        onRename={vi.fn()}
        onReveal={vi.fn()}
      />,
    )

    fireEvent.click(screen.getByTestId('delete-folder-menu-item'))
    expect(onDelete).toHaveBeenCalledWith('projects', '/Users/luca/Team')
  })
})
