import { fireEvent, render, screen } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { SideWorkspaceHeader } from './AiWorkspaceSideHeader'

const { startDragging } = vi.hoisted(() => ({
  startDragging: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@tauri-apps/api/window', () => ({
  getCurrentWindow: () => ({ startDragging }),
}))

it.each([false, true])('drags the window from the AI header background (expanded: %s)', (expanded) => {
  startDragging.mockClear()
  render(
    <SideWorkspaceHeader
      activeId=""
      conversations={[]}
      expanded={expanded}
      locale="en"
      onClose={vi.fn()}
      onCloseConversation={vi.fn()}
      onNewChat={vi.fn()}
      onRename={vi.fn()}
      onReorder={vi.fn()}
      onSelect={vi.fn()}
      onToggleExpanded={vi.fn()}
      separated={false}
      statuses={{}}
    />,
  )

  fireEvent.mouseDown(screen.getByRole('button', { name: 'New chat' }), { button: 0 })
  expect(startDragging).not.toHaveBeenCalled()

  fireEvent.mouseDown(screen.getByTestId('ai-workspace-side-header'), { button: 0 })
  expect(startDragging).toHaveBeenCalledOnce()
})
