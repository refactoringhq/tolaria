import { describe, expect, it } from 'vitest'
import { mobilePropertyDisplay } from './mobilePropertyDisplay'

describe('mobile property display', () => {
  it('matches desktop friendly date rendering for date-like properties', () => {
    expect(mobilePropertyDisplay('Deadline', '2026-03-31')).toMatchObject({
      kind: 'date',
      text: 'Mar 31, 2026',
    })
    expect(mobilePropertyDisplay('Due', '02/25/2026')).toMatchObject({
      kind: 'date',
      text: 'Feb 25, 2026',
    })
  })

  it('keeps typed display metadata for non-text property values', () => {
    expect(mobilePropertyDisplay('Published', false, { false: 'No', true: 'Yes' })).toMatchObject({
      kind: 'boolean',
      text: 'No',
    })
    expect(mobilePropertyDisplay('Estimate', 13)).toMatchObject({
      kind: 'number',
      text: '13',
    })
    expect(mobilePropertyDisplay('Brand color', '#155DFF')).toMatchObject({
      colorValue: '#155DFF',
      kind: 'color',
      text: '#155DFF',
    })
    expect(mobilePropertyDisplay('Areas', ['Design', 'AI'])).toMatchObject({
      kind: 'list',
      listItems: ['Design', 'AI'],
      text: 'Design, AI',
    })
  })

  it('uses desktop-style status and url detection for string values', () => {
    expect(mobilePropertyDisplay('Status', 'Active')).toMatchObject({
      kind: 'status',
      text: 'Active',
    })
    expect(mobilePropertyDisplay('URL', 'https://tolaria.app')).toMatchObject({
      kind: 'url',
      text: 'https://tolaria.app',
    })
    expect(mobilePropertyDisplay('Priority', 'High')).toMatchObject({
      kind: 'string',
      text: 'High',
    })
  })

  it('honors persisted desktop display-mode overrides', () => {
    expect(mobilePropertyDisplay('Priority', 'High', undefined, { Priority: 'status' })).toMatchObject({
      kind: 'status',
      text: 'High',
    })
    expect(mobilePropertyDisplay('People', ['Luca', 'Brian'], undefined, { People: 'tags' })).toMatchObject({
      kind: 'list',
      listItems: ['Luca', 'Brian'],
      text: 'Luca, Brian',
    })
  })
})
