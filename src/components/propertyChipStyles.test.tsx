import { render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { TagPillList } from './EditableValue'
import { SmartPropertyValueCell } from './PropertyValueCells'
import { TypeSelector } from './TypeSelector'

function expectSharedChipSize(element: HTMLElement | null) {
  expect(element).toHaveStyle({
    height: '24px',
    borderRadius: '6px',
    padding: '0px 8px',
    fontSize: '12px',
    fontWeight: '500',
  })
}

function renderPropertyChips() {
  const edit = { isEditing: false, onStartEdit: vi.fn(), onSave: vi.fn(), onSaveList: vi.fn() }
  render(
    <>
      <TypeSelector isA="Project" customColorKey={null} availableTypes={['Project']}
        typeColorKeys={{ Project: null }} typeIconKeys={{ Project: null }} onUpdateProperty={vi.fn()} />
      <SmartPropertyValueCell {...edit} propKey="Status" value="Active" displayMode="status"
        vaultStatuses={['Active']} vaultTags={[]} />
      <SmartPropertyValueCell {...edit} propKey="Tags" value={['Very long property tag']} displayMode="tags"
        vaultStatuses={[]} vaultTags={['Very long property tag']} />
      <SmartPropertyValueCell {...edit} propKey="Due" value="2026-04-14" displayMode="date"
        vaultStatuses={[]} vaultTags={[]} />
      <TagPillList items={['Alpha']} onSave={vi.fn()} label="People" />
    </>
  )
}

describe('property chip sizing', () => {
  it('keeps type, status, tag, date, and generic pills on the same size system', () => {
    renderPropertyChips()

    const typeChip = within(screen.getByTestId('type-selector')).getByRole('combobox')
    const statusChip = screen.getByTestId('status-badge')
    const tagChip = screen.getByText('Very long property tag').parentElement
    const dateChip = screen.getByTestId('date-display')
    const elements = [
      typeChip,
      statusChip,
      tagChip,
      dateChip,
      screen.getByText('Alpha').parentElement,
      screen.getByTestId('tags-add-button'),
      screen.getByTitle('Add people'),
    ]
    elements.forEach(expectSharedChipSize)
    expect(statusChip).toHaveAttribute('data-property-chip-tone', 'status')
    expect(statusChip.style.color).toBe('')
    expect(statusChip.querySelector<HTMLElement>('.status-chip-dot')?.style.backgroundColor).toBe('var(--accent-green-text)')
    expect(tagChip).toHaveAttribute('data-property-chip-tone', 'tag')
    expect(tagChip?.style.maxWidth).toBe('120px')
  })
})
