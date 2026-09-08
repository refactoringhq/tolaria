import { describe, expect, it } from 'vitest'
import inlineMarkdownContract from '../shared/inlineMarkdownContract.json'
import { extractSnippet } from './wikilinks'

describe('inline markdown contract', () => {
  it.each(inlineMarkdownContract.fixtures)('matches snippet behavior: $name', ({ input, expected }) => {
    expect(extractSnippet(`# Contract\n\n${input}`)).toBe(expected)
  })
})
