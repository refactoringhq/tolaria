import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  activateWorkbookRoot,
  getIronCalcMock,
  resetSheetEditorTestState,
} from './SheetEditor.testUtils'
import { SheetEditor } from './SheetEditor'
import { MAX_SHEET_COLUMNS, MAX_SHEET_ROWS } from '../utils/sheetWorkbook'

const ironCalcMock = getIronCalcMock()

function renderSheetEditor() {
  render(
    <SheetEditor
      content={'---\ntype: Sheet\n---\nMetric,January'}
      path="/vault/budget.md"
      onContentChange={vi.fn()}
    />,
  )
}

function selectInteriorCell() {
  ironCalcMock.state.selectedView = {
    column: 4,
    left_column: 2,
    range: [8, 4, 8, 4],
    row: 8,
    sheet: 0,
    top_row: 3,
  }
}

describe('SheetEditor edge navigation', () => {
  afterEach(() => {
    resetSheetEditorTestState()
  })

  it('handles command-arrow sheet edge navigation before IronCalc placeholder handlers run', async () => {
    renderSheetEditor()
    const { workbookRoot } = await activateWorkbookRoot()
    selectInteriorCell()

    expect(() => {
      fireEvent.keyDown(workbookRoot, { key: 'ArrowRight', metaKey: true })
    }).not.toThrow()
    expect(ironCalcMock.state.selectedView).toMatchObject({
      column: MAX_SHEET_COLUMNS,
      left_column: MAX_SHEET_COLUMNS,
      row: 8,
      top_row: 3,
    })

    expect(() => {
      fireEvent.keyDown(workbookRoot, { key: 'ArrowDown', metaKey: true })
    }).not.toThrow()
    expect(ironCalcMock.state.selectedView).toMatchObject({
      column: MAX_SHEET_COLUMNS,
      left_column: MAX_SHEET_COLUMNS,
      row: MAX_SHEET_ROWS,
      top_row: MAX_SHEET_ROWS,
    })

    expect(() => {
      fireEvent.keyDown(workbookRoot, { key: 'ArrowLeft', ctrlKey: true })
    }).not.toThrow()
    expect(ironCalcMock.state.selectedView).toMatchObject({
      column: 1,
      left_column: 1,
      row: MAX_SHEET_ROWS,
      top_row: MAX_SHEET_ROWS,
    })

    expect(() => {
      fireEvent.keyDown(workbookRoot, { key: 'ArrowUp', ctrlKey: true })
    }).not.toThrow()
    expect(ironCalcMock.state.selectedView).toMatchObject({
      column: 1,
      left_column: 1,
      row: 1,
      top_row: 1,
    })
  })

  it('preserves a committed cell when IronCalc clears its editor before blur', async () => {
    render(
      <SheetEditor
        content={'---\n_display: sheet\n---\nMetric,old\nRevenue,foo'}
        path="/vault/budget.md"
        onContentChange={vi.fn()}
      />,
    )
    ironCalcMock.state.selectedView = {
      column: 2,
      left_column: 1,
      range: [1, 2, 1, 2],
      row: 1,
      sheet: 0,
      top_row: 1,
    }
    const { workbookRoot } = await activateWorkbookRoot()
    const cellEditor = screen.getByLabelText<HTMLTextAreaElement>('Cell editor')
    cellEditor.focus()

    fireEvent.input(cellEditor, { target: { value: 'old' } })
    fireEvent.pointerDown(workbookRoot)
    ironCalcMock.state.selectedView = { ...ironCalcMock.state.selectedView, range: [2, 2, 2, 2], row: 2 }
    cellEditor.value = ''
    fireEvent.blur(cellEditor)

    expect(ironCalcMock.state.lastModel?.getRawCellContent(0, 1, 2)).toBe('old')
    expect(ironCalcMock.state.lastModel?.getRawCellContent(0, 2, 2)).toBe('foo')
  })

  it.each([
    ['ArrowLeft', false, 1, 1],
    ['ArrowUp', false, 1, 1],
    ['Tab', true, 1, 1],
    ['Enter', true, 1, 1],
    ['ArrowRight', false, 1, MAX_SHEET_COLUMNS],
    ['ArrowDown', false, MAX_SHEET_ROWS, 1],
    ['Tab', false, 1, MAX_SHEET_COLUMNS],
    ['Enter', false, MAX_SHEET_ROWS, 1],
  ])('blocks %s navigation beyond the sheet boundary', async (key, shiftKey, row, column) => {
    renderSheetEditor()
    await activateWorkbookRoot()
    ironCalcMock.state.selectedView = {
      column,
      left_column: column,
      range: [row, column, row, column],
      row,
      sheet: 0,
      top_row: row,
    }
    const cellEditor = screen.getByLabelText<HTMLTextAreaElement>('Cell editor')
    cellEditor.focus()
    fireEvent.input(cellEditor, { target: { value: 'boundary' } })

    expect(fireEvent.keyDown(cellEditor, { key, shiftKey })).toBe(false)
    expect(ironCalcMock.state.selectedView).toMatchObject({ column, row })
  })
})
