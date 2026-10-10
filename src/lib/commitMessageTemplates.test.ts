import { describe, it, expect } from 'vitest'
import {
  DEFAULT_COMMIT_MESSAGE_TEMPLATE,
  applyTemplateToMessage,
  createCommitMessageTemplate,
  getAvailableTemplates,
  joinCommitMessage,
  normalizeCommitMessageTemplates,
  renderTemplateVariables,
  splitCommitMessage,
  validateCommitMessageTemplate,
  type CommitMessageTemplate,
  type TemplateVariableContext,
} from './commitMessageTemplates'

const CONTEXT: TemplateVariableContext = {
  date: '2026-10-08',
  branch: 'main',
  vault: 'notes',
}

function makeTemplate(overrides: Partial<CommitMessageTemplate> = {}): CommitMessageTemplate {
  return {
    id: 'tpl-1',
    name: 'Daily notes',
    titleTemplate: 'docs: {vault} update {date}',
    bodyTemplate: 'Branch {branch}',
    ...overrides,
  }
}

describe('normalizeCommitMessageTemplates', () => {
  it('returns an empty list for missing or invalid input', () => {
    expect(normalizeCommitMessageTemplates(null)).toEqual([])
    expect(normalizeCommitMessageTemplates(undefined)).toEqual([])
    expect(normalizeCommitMessageTemplates('nope')).toEqual([])
    expect(normalizeCommitMessageTemplates({})).toEqual([])
  })

  it('trims fields and keeps valid templates', () => {
    const normalized = normalizeCommitMessageTemplates([
      { id: '  a  ', name: '  Named  ', titleTemplate: '  Title  ', bodyTemplate: '  Body  ' },
    ])
    expect(normalized).toEqual([
      { id: 'a', name: 'Named', titleTemplate: 'Title', bodyTemplate: 'Body' },
    ])
  })

  it('drops templates with blank id, name, or title template', () => {
    const normalized = normalizeCommitMessageTemplates([
      makeTemplate({ id: 'ok' }),
      makeTemplate({ id: '', name: 'x', titleTemplate: 'y' }),
      makeTemplate({ id: 'ok-2', name: '   ', titleTemplate: 'y' }),
      makeTemplate({ id: 'ok-3', name: 'x', titleTemplate: '' }),
      makeTemplate({ id: 'ok-4', name: 'x', titleTemplate: 'y', bodyTemplate: '' }),
    ])
    expect(normalized.map((template) => template.id)).toEqual(['ok', 'ok-4'])
  })

  it('allows an empty body template', () => {
    const normalized = normalizeCommitMessageTemplates([makeTemplate({ bodyTemplate: '' })])
    expect(normalized[0]?.bodyTemplate).toBe('')
  })
})

describe('createCommitMessageTemplate', () => {
  it('generates a unique id and trims fields', () => {
    const first = createCommitMessageTemplate({ name: '  A  ', titleTemplate: ' T ', bodyTemplate: ' B ' })
    const second = createCommitMessageTemplate({ name: 'A', titleTemplate: 'T', bodyTemplate: 'B' })
    expect(first.id).not.toBe('')
    expect(first.id).not.toBe(second.id)
    expect(first).toMatchObject({ name: 'A', titleTemplate: 'T', bodyTemplate: 'B' })
  })
})

describe('validateCommitMessageTemplate', () => {
  it('accepts a complete template', () => {
    expect(validateCommitMessageTemplate({ name: 'Daily', titleTemplate: 'Title', bodyTemplate: '' })).toEqual({})
  })

  it('reports blank name and blank title template', () => {
    const errors = validateCommitMessageTemplate({ name: '   ', titleTemplate: '', bodyTemplate: '' })
    expect(errors.name).toBe('settings.commitTemplates.validation.nameRequired')
    expect(errors.titleTemplate).toBe('settings.commitTemplates.validation.titleRequired')
    expect(errors.bodyTemplate).toBeUndefined()
  })
})

describe('renderTemplateVariables', () => {
  it('replaces known variables', () => {
    expect(renderTemplateVariables('{vault} on {branch} at {date}', CONTEXT)).toBe('notes on main at 2026-10-08')
  })

  it('replaces repeated variables', () => {
    expect(renderTemplateVariables('{vault}/{vault}', CONTEXT)).toBe('notes/notes')
  })

  it('keeps unknown variables untouched', () => {
    expect(renderTemplateVariables('fix {issue} on {branch}', CONTEXT)).toBe('fix {issue} on main')
  })

  it('leaves text without variables unchanged', () => {
    expect(renderTemplateVariables('plain title', CONTEXT)).toBe('plain title')
  })

  it('leaves malformed braces untouched', () => {
    expect(renderTemplateVariables('{date not closed', CONTEXT)).toBe('{date not closed')
    expect(renderTemplateVariables('date} stray', CONTEXT)).toBe('date} stray')
  })

  it('renders empty string for missing context values', () => {
    expect(renderTemplateVariables('on {branch}', { ...CONTEXT, branch: '' })).toBe('on ')
  })
})

describe('splitCommitMessage', () => {
  it('splits the first line into title and the rest into body', () => {
    expect(splitCommitMessage('Title line\n\nBody line one\nBody line two')).toEqual({
      title: 'Title line',
      body: 'Body line one\nBody line two',
    })
  })

  it('returns an empty body for a single line', () => {
    expect(splitCommitMessage('Just a title')).toEqual({ title: 'Just a title', body: '' })
  })

  it('trims surrounding whitespace', () => {
    expect(splitCommitMessage('  Title  \n\n  Body  \n')).toEqual({ title: 'Title', body: 'Body' })
  })

  it('handles an empty message', () => {
    expect(splitCommitMessage('')).toEqual({ title: '', body: '' })
  })
})

describe('joinCommitMessage', () => {
  it('joins title and body with a blank line', () => {
    expect(joinCommitMessage('Title', 'Body')).toBe('Title\n\nBody')
  })

  it('returns only the title when the body is blank', () => {
    expect(joinCommitMessage('Title', '   ')).toBe('Title')
  })

  it('trims both parts', () => {
    expect(joinCommitMessage('  Title  ', '  Body  ')).toBe('Title\n\nBody')
  })
})

describe('default template', () => {
  it('provides a usable default template using supported variables', () => {
    expect(DEFAULT_COMMIT_MESSAGE_TEMPLATE.name.trim()).not.toBe('')
    expect(DEFAULT_COMMIT_MESSAGE_TEMPLATE.titleTemplate.trim()).not.toBe('')
    const applied = applyTemplateToMessage(DEFAULT_COMMIT_MESSAGE_TEMPLATE, CONTEXT)
    expect(applied.title).toContain('2026-10-08')
    expect(applied.title).not.toContain('{date}')
  })

  it('lists the default template when no custom templates exist', () => {
    expect(getAvailableTemplates([])).toEqual([DEFAULT_COMMIT_MESSAGE_TEMPLATE])
  })

  it('keeps custom templates ahead of the default template', () => {
    const custom = makeTemplate({ id: 'custom-1' })
    expect(getAvailableTemplates([custom])).toEqual([custom, DEFAULT_COMMIT_MESSAGE_TEMPLATE])
  })
})

describe('applyTemplateToMessage', () => {
  it('renders title and body templates with the variable context', () => {
    expect(applyTemplateToMessage(makeTemplate(), CONTEXT)).toEqual({
      title: 'docs: notes update 2026-10-08',
      body: 'Branch main',
    })
  })

  it('never throws for templates with unknown variables', () => {
    const applied = applyTemplateToMessage(makeTemplate({ titleTemplate: '{mystery}' }), CONTEXT)
    expect(applied.title).toBe('{mystery}')
  })
})
