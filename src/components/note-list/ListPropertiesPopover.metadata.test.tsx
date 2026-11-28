import { fireEvent, render, screen, within } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { TooltipProvider } from '../ui/tooltip'
import { ListPropertiesPopover } from './ListPropertiesPopover'
import { HIDE_CREATED_TIME } from './noteListMetadata'

it('stores computed timestamp visibility alongside the selected note properties', () => {
  const onSave = vi.fn()
  const picker = (currentDisplay: string[]) => (
    <TooltipProvider>
      <ListPropertiesPopover
        scope="all"
        availableProperties={['Tags']}
        currentDisplay={currentDisplay}
        onSave={onSave}
        triggerTitle="Show properties"
      />
    </TooltipProvider>
  )
  const { rerender } = render(picker(['Tags']))
  fireEvent.click(screen.getByRole('button', { name: 'Show properties' }))

  const computed = within(screen.getByRole('group', { name: 'Computed fields' }))
  fireEvent.click(computed.getByRole('checkbox', { name: 'Created' }))
  expect(onSave).toHaveBeenLastCalledWith(['Tags', HIDE_CREATED_TIME])

  rerender(picker(['Tags', HIDE_CREATED_TIME]))
  expect(computed.getByRole('checkbox', { name: 'Created' })).not.toBeChecked()
  expect(computed.getByRole('checkbox', { name: 'Modified' })).toBeChecked()
  fireEvent.click(computed.getByRole('checkbox', { name: 'Created' }))
  expect(onSave).toHaveBeenLastCalledWith(['Tags'])
})
