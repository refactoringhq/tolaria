import { act, renderHook } from '@testing-library/react'
import type { DragEndEvent, DragOverEvent, DragStartEvent } from '@dnd-kit/core'
import { describe, expect, it, vi } from 'vitest'
import { makeEntry } from '../../test-utils/noteListTestUtils'
import type { VaultEntry } from '../../types'
import { cardId, columnId } from './kanbanModel'
import { useKanbanDrag, usePendingMoves } from './useKanbanDrag'

const alpha = makeEntry({ path: '/vault/a.md', title: 'Alpha', status: 'Doing' })

function startEvent(id: string, entry?: VaultEntry) {
  return { active: { id, data: { current: entry ? { entry } : {} } } } as unknown as DragStartEvent
}

function overEvent(group: string | null) {
  return { over: group === null ? null : { id: columnId(group) } } as unknown as DragOverEvent & DragEndEvent
}

function setup(entries: VaultEntry[] = [alpha]) {
  const onMove = vi.fn()
  const onColumnOrderChange = vi.fn()
  const hook = renderHook(({ items }) => {
    const [pending, setPending] = usePendingMoves(items, 'status')
    const drag = useKanbanDrag({ groupBy: 'status', columns: ['Doing', 'Done', ''], pending, setPending, onMove, onColumnOrderChange })
    return { drag, pending }
  }, { initialProps: { items: entries } })
  return { hook, onMove, onColumnOrderChange }
}

describe('useKanbanDrag', () => {
  it('drops a card in another column through the property writer and keeps it there optimistically', () => {
    const { hook, onMove } = setup()
    act(() => hook.result.current.drag.onDragStart(startEvent(cardId(alpha.path), alpha)))
    act(() => hook.result.current.drag.onDragOver(overEvent('Done')))
    expect(hook.result.current.drag.crossColumnDrop).toBe(true)

    act(() => hook.result.current.drag.onDragEnd(overEvent('Done')))

    expect(onMove).toHaveBeenCalledWith(alpha, 'Done')
    expect(hook.result.current.pending.get(alpha.path)).toBe('Done')
    expect(hook.result.current.drag.droppedPath).toBe(alpha.path)
    expect(hook.result.current.drag.active).toBeNull()

    hook.rerender({ items: [{ ...alpha, status: 'Done' }] })
    expect(hook.result.current.pending.size).toBe(0)
  })

  it('clears the property when a card lands in "No value" and ignores drops on its own column', () => {
    const { hook, onMove } = setup()
    act(() => hook.result.current.drag.onDragStart(startEvent(cardId(alpha.path), alpha)))
    act(() => hook.result.current.drag.onDragEnd(overEvent('Doing')))
    expect(onMove).not.toHaveBeenCalled()

    act(() => hook.result.current.drag.onDragStart(startEvent(cardId(alpha.path), alpha)))
    act(() => hook.result.current.drag.onDragEnd(overEvent('')))
    expect(onMove).toHaveBeenCalledWith(alpha, null)
  })

  it('reorders columns and ignores drops outside the board', () => {
    const { hook, onColumnOrderChange, onMove } = setup()
    act(() => hook.result.current.drag.onDragStart(startEvent(columnId('Doing'))))
    expect(hook.result.current.drag.active).toEqual({ kind: 'column', group: 'Doing' })
    act(() => hook.result.current.drag.onDragEnd(overEvent('')))
    expect(onColumnOrderChange).toHaveBeenCalledWith(['Done', '', 'Doing'])

    act(() => hook.result.current.drag.onDragStart(startEvent(cardId(alpha.path), alpha)))
    act(() => hook.result.current.drag.onDragEnd(overEvent(null)))
    act(() => hook.result.current.drag.onDragStart(startEvent('unknown')))
    act(() => hook.result.current.drag.onDragCancel())
    expect(onMove).not.toHaveBeenCalled()
    expect(hook.result.current.drag.active).toBeNull()
  })
})
