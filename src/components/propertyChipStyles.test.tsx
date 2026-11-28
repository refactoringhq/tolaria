import { render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { TagPillList } from './EditableValue'
import { SmartPropertyValueCell } from './PropertyValueCells'
import { TypeSelector } from './TypeSelector'

function expectSharedChipSize(element: HTMLElement | null) {
  expect(element).not.toBeNull()
  expect(element?.style.height).toBe('24px')
  expect(element?.style.borderRadius).toBe('6px')
  expect(element?.style.paddingTop).toBe('0px')
  expect(element?.style.paddingRight).toBe('8px')
  expect(element?.style.paddingBottom).toBe('0px')
  expect(element?.style.paddingLeft).toBe('8px')
  expect(element?.style.fontSize).toBe('12px')
  expect(element?.style.fontWeight).toBe('500')
}

describe('property chip sizing', () => {
  it('keeps type, status, tag, date, and generic pills on the same size system', () => {
    render(
      <>
        <TypeSelector
          isA="Project"
          customColorKey={null}
          availableTypes={['Project']}
          typeColorKeys={{ Project: null }}
          typeIconKeys={{ Project: null }}
          onUpdateProperty={vi.fn()}
        />
        <SmartPropertyValueCell
          propKey="Status"
          value="Active"
          displayMode="status"
          isEditing={false}
          vaultStatuses={['Active']}
          vaultTags={[]}
          onStartEdit={vi.fn()}
          onSave={vi.fn()}
          onSaveList={vi.fn()}
        />
        <SmartPropertyValueCell
          propKey="Tags"
          value={['Very long property tag']}
          displayMode="tags"
          isEditing={false}
          vaultStatuses={[]}
          vaultTags={['Very long property tag']}
          onStartEdit={vi.fn()}
          onSave={vi.fn()}
          onSaveList={vi.fn()}
        />
        <SmartPropertyValueCell
          propKey="Due"
          value="2026-04-14"
          displayMode="date"
          isEditing={false}
          vaultStatuses={[]}
          vaultTags={[]}
          onStartEdit={vi.fn()}
          onSave={vi.fn()}
          onSaveList={vi.fn()}
        />
        <TagPillList items={['Alpha']} onSave={vi.fn()} label="People" />
      </>
    )

    const typeChip = within(screen.getByTestId('type-selector')).getByRole('combobox')
    const statusChip = screen.getByTestId('status-badge')
    const tagChip = screen.getByText('Very long property tag').parentElement
    const dateChip = screen.getByTestId('date-display')
    const genericChip = screen.getByText('Alpha').parentElement
    const tagsAddButton = screen.getByTestId('tags-add-button')
    const genericAddButton = screen.getByTitle('Add people')

    expectSharedChipSize(typeChip)
    expectSharedChipSize(statusChip)
    expectSharedChipSize(tagChip)
    expectSharedChipSize(dateChip)
    expectSharedChipSize(genericChip)
    expectSharedChipSize(tagsAddButton)
    expectSharedChipSize(genericAddButton)
    expect(tagChip?.style.maxWidth).toBe('120px')
  })
})
