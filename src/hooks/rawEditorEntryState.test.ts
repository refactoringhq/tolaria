import { describe, expect, it } from 'vitest'
import { deriveRawEditorEntryState } from './rawEditorEntryState'

describe('deriveRawEditorEntryState', () => {
  it('keeps Type status as an instance-default property with its source spelling', () => {
    const state = deriveRawEditorEntryState('---\ntype: Type\nStatus: Active\ncolor: red\n---\n# Project\n')

    expect(state.status).toBe('Active')
    expect(state.properties).toEqual({ Status: 'Active' })
  })

  it('keeps status out of properties for non-Type notes', () => {
    const state = deriveRawEditorEntryState('---\ntype: Project\nStatus: Active\n---\n# Launch\n')

    expect(state.status).toBe('Active')
    expect(state.properties).toEqual({})
  })
})
