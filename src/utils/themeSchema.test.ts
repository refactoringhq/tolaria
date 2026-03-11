import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import { buildThemeSchema, formatValueForFrontmatter, parseValueFromFrontmatter } from './themeSchema'
import type { ThemeProperty } from './themeSchema'

describe('buildThemeSchema', () => {
  const schema = buildThemeSchema()

  it('returns all top-level sections from theme.json', () => {
    const ids = schema.map(s => s.id)
    expect(ids).toContain('editor')
    expect(ids).toContain('headings')
    expect(ids).toContain('lists')
    expect(ids).toContain('checkboxes')
    expect(ids).toContain('inlineStyles')
    expect(ids).toContain('codeBlocks')
    expect(ids).toContain('blockquote')
    expect(ids).toContain('table')
    expect(ids).toContain('horizontalRule')
    expect(ids).toContain('colors')
  })

  it('assigns human-readable labels to sections', () => {
    const editor = schema.find(s => s.id === 'editor')!
    expect(editor.label).toBe('Typography')
    const headings = schema.find(s => s.id === 'headings')!
    expect(headings.label).toBe('Headings')
  })

  it('produces flat CSS variable names from editor section', () => {
    const editor = schema.find(s => s.id === 'editor')!
    const vars = editor.properties.map(p => p.cssVar)
    expect(vars).toContain('editor-font-family')
    expect(vars).toContain('editor-font-size')
    expect(vars).toContain('editor-line-height')
    expect(vars).toContain('editor-max-width')
    expect(vars).toContain('editor-padding-horizontal')
    expect(vars).toContain('editor-paragraph-spacing')
  })

  it('detects numeric input type for number values', () => {
    const editor = schema.find(s => s.id === 'editor')!
    const fontSize = editor.properties.find(p => p.cssVar === 'editor-font-size')!
    expect(fontSize.inputType).toBe('number')
    expect(fontSize.unit).toBe('px')
    expect(fontSize.defaultValue).toBe(15)
  })

  it('detects unitless numbers for lineHeight and fontWeight', () => {
    const editor = schema.find(s => s.id === 'editor')!
    const lineHeight = editor.properties.find(p => p.cssVar === 'editor-line-height')!
    expect(lineHeight.inputType).toBe('number')
    expect(lineHeight.unit).toBeUndefined()
  })

  it('detects text input type for font family', () => {
    const editor = schema.find(s => s.id === 'editor')!
    const fontFamily = editor.properties.find(p => p.cssVar === 'editor-font-family')!
    expect(fontFamily.inputType).toBe('text')
  })

  it('creates subsections for headings h1-h4', () => {
    const headings = schema.find(s => s.id === 'headings')!
    const subIds = headings.subsections.map(s => s.id)
    expect(subIds).toContain('h1')
    expect(subIds).toContain('h2')
    expect(subIds).toContain('h3')
    expect(subIds).toContain('h4')
  })

  it('produces correct CSS var names for heading subsections', () => {
    const headings = schema.find(s => s.id === 'headings')!
    const h1 = headings.subsections.find(s => s.id === 'h1')!
    const vars = h1.properties.map(p => p.cssVar)
    expect(vars).toContain('headings-h1-font-size')
    expect(vars).toContain('headings-h1-font-weight')
    expect(vars).toContain('headings-h1-line-height')
    expect(vars).toContain('headings-h1-margin-top')
    expect(vars).toContain('headings-h1-color')
    expect(vars).toContain('headings-h1-letter-spacing')
  })

  it('detects color values from var(--) references', () => {
    const headings = schema.find(s => s.id === 'headings')!
    const h1 = headings.subsections.find(s => s.id === 'h1')!
    const color = h1.properties.find(p => p.cssVar === 'headings-h1-color')!
    expect(color.inputType).toBe('color')
  })

  it('detects hex color values', () => {
    const lists = schema.find(s => s.id === 'lists')!
    const bulletColor = lists.properties.find(p => p.cssVar === 'lists-bullet-color')!
    expect(bulletColor.inputType).toBe('color')
  })

  it('creates subsections for inline styles', () => {
    const inline = schema.find(s => s.id === 'inlineStyles')!
    const subIds = inline.subsections.map(s => s.id)
    expect(subIds).toContain('bold')
    expect(subIds).toContain('italic')
    expect(subIds).toContain('code')
    expect(subIds).toContain('link')
    expect(subIds).toContain('wikilink')
  })

  it('produces correct CSS var names for code blocks section', () => {
    const codeBlocks = schema.find(s => s.id === 'codeBlocks')!
    const vars = codeBlocks.properties.map(p => p.cssVar)
    expect(vars).toContain('code-blocks-font-family')
    expect(vars).toContain('code-blocks-font-size')
    expect(vars).toContain('code-blocks-background-color')
    expect(vars).toContain('code-blocks-border-radius')
  })

  it('skips array values like nestedBulletSymbols', () => {
    const lists = schema.find(s => s.id === 'lists')!
    const vars = lists.properties.map(p => p.cssVar)
    expect(vars).not.toContain('lists-nested-bullet-symbols')
  })

  it('assigns select input type for fontStyle', () => {
    const blockquote = schema.find(s => s.id === 'blockquote')!
    const fontStyle = blockquote.properties.find(p => p.cssVar === 'blockquote-font-style')!
    expect(fontStyle.inputType).toBe('select')
    expect(fontStyle.options).toContain('normal')
    expect(fontStyle.options).toContain('italic')
  })

  it('every var(--xxx) in EditorTheme.css has a matching default in theme schema or base UI', () => {
    const cssPath = resolve(__dirname, '../components/EditorTheme.css')
    const css = readFileSync(cssPath, 'utf-8')

    // Extract all var(--xxx) references (first arg only, ignore fallbacks)
    const varRegex = /var\(--([a-z0-9-]+)/g
    const usedVars = new Set<string>()
    let match: RegExpExecArray | null
    while ((match = varRegex.exec(css)) !== null) {
      usedVars.add(match[1])
    }

    // Collect all CSS var names from the schema
    const schemaVars = new Set<string>()
    for (const section of schema) {
      for (const prop of section.properties) schemaVars.add(prop.cssVar)
      for (const sub of section.subsections) {
        for (const prop of sub.properties) schemaVars.add(prop.cssVar)
      }
    }

    // Base UI color vars set by the theme color system (not in theme.json schema)
    const baseUIVars = new Set([
      'border-primary', 'bg-primary', 'bg-card', 'bg-hover-subtle', 'bg-selected',
      'text-primary', 'text-secondary', 'text-muted', 'text-heading', 'text-tertiary',
      'accent-blue',
    ])

    for (const varName of usedVars) {
      expect(
        schemaVars.has(varName) || baseUIVars.has(varName),
      ).toBe(true)
    }
  })
})

describe('formatValueForFrontmatter', () => {
  it('appends unit to numeric values', () => {
    const prop: ThemeProperty = {
      cssVar: 'editor-font-size', label: 'Font Size', defaultValue: 15,
      inputType: 'number', unit: 'px', min: 0,
    }
    expect(formatValueForFrontmatter(15, prop)).toBe('15px')
  })

  it('does not append unit for unitless values', () => {
    const prop: ThemeProperty = {
      cssVar: 'editor-line-height', label: 'Line Height', defaultValue: 1.5,
      inputType: 'number',
    }
    expect(formatValueForFrontmatter(1.5, prop)).toBe('1.5')
  })

  it('returns string values as-is', () => {
    const prop: ThemeProperty = {
      cssVar: 'editor-font-family', label: 'Font Family', defaultValue: 'Inter',
      inputType: 'text',
    }
    expect(formatValueForFrontmatter('Helvetica', prop)).toBe('Helvetica')
  })
})

describe('parseValueFromFrontmatter', () => {
  it('extracts numeric value from string with unit', () => {
    const prop: ThemeProperty = {
      cssVar: 'editor-font-size', label: 'Font Size', defaultValue: 15,
      inputType: 'number', unit: 'px',
    }
    expect(parseValueFromFrontmatter('15px', prop)).toBe(15)
  })

  it('returns string for non-numeric values', () => {
    const prop: ThemeProperty = {
      cssVar: 'editor-font-family', label: 'Font Family', defaultValue: 'Inter',
      inputType: 'text',
    }
    expect(parseValueFromFrontmatter('Helvetica', prop)).toBe('Helvetica')
  })

  it('parses bare numbers', () => {
    const prop: ThemeProperty = {
      cssVar: 'editor-line-height', label: 'Line Height', defaultValue: 1.5,
      inputType: 'number',
    }
    expect(parseValueFromFrontmatter('1.6', prop)).toBe(1.6)
  })
})
