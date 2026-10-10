import { expect, it } from 'vitest'
import { nativeWysiwygFormattingActions } from './MobileWysiwygFormatCommands'
import { formattingToolbarGroups, formattingToolbarSelection } from './mobileFormattingToolbarModel'

it('keeps four primary actions and groups every other supported command exactly once', () => {
  const groups = formattingToolbarGroups(nativeWysiwygFormattingActions, true)
  expect(groups.primary).toEqual(['bold', 'italic', 'link', 'wikilink'])
  const flattened = Object.values(groups).flat()
  expect(new Set(flattened).size).toBe(flattened.length)
  expect(new Set(flattened)).toEqual(new Set(nativeWysiwygFormattingActions))
})

it('only exposes table mutation controls inside a table', () => {
  const groups = formattingToolbarGroups(nativeWysiwygFormattingActions, false)
  expect(groups.table).toEqual([])
  expect(groups.insert).toContain('table')
  expect(groups.headings).toHaveLength(6)
})

it('does not expose unsupported actions in a restricted editor', () => {
  expect(formattingToolbarGroups(['bold', 'heading2'], false)).toEqual({
    primary: ['bold'], headings: ['heading2'], lists: [], insert: [], more: [], table: [],
  })
})

it('reflects formatting at the cursor instead of maintaining a separate toggle state', () => {
  expect(formattingToolbarSelection({ isBoldActive: true, isItalicActive: false, headingLevel: 2, isTaskListActive: true }))
    .toEqual(['bold', 'taskList', 'heading2'])
  expect(formattingToolbarSelection({})).toEqual([])
})
