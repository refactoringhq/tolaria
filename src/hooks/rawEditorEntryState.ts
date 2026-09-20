import type { VaultEntry, VaultPropertyValue } from '../types'
import { parseFrontmatter } from '../utils/frontmatter'
import { splitFrontmatter } from '../utils/wikilinks'
import { frontmatterToEntryPatch, type PropertiesPatch } from './frontmatterOps'

const TYPE_DOCUMENT_FRONTMATTER = /(?:^|\n)\s*(?:type|is_a|is a)\s*:\s*["']?Type["']?\s*(?:\n|$)/i

function isTemplateField(line: string): boolean {
  const trimmed = line.trim()
  if (!trimmed.endsWith(':')) return false
  const label = trimmed.slice(0, -1).trim()
  return label.length > 0 && !label.startsWith('-')
}

function isStructuredTemplateLine(line: string): boolean {
  const trimmed = line.trimStart()
  return trimmed.startsWith('## ') || trimmed.startsWith('- [ ] ') || isTemplateField(trimmed)
}

function bodyTemplate(content: string): string | null {
  const [, body] = splitFrontmatter(content)
  const trimmedBody = body.trimStart()
  const lineBreak = trimmedBody.indexOf('\n')
  const firstLine = (lineBreak === -1 ? trimmedBody : trimmedBody.slice(0, lineBreak)).replace(/\r$/, '')
  if (!firstLine.startsWith('# ') || firstLine.slice(2).trim().length === 0) return null

  const template = (lineBreak === -1 ? '' : trimmedBody.slice(lineBreak + 1)).trim()
  return template.split('\n').some(isStructuredTemplateLine) ? template : null
}

function createRawEditorEntryState(): Partial<VaultEntry> {
  return {
    aliases: [],
    archived: false,
    belongsTo: [],
    color: null,
    favorite: false,
    favoriteIndex: null,
    icon: null,
    isA: null,
    listPropertiesDisplay: [],
    order: null,
    organized: false,
    properties: {},
    relatedTo: [],
    relationships: {},
    sidebarLabel: null,
    sort: null,
    status: null,
    template: null,
    view: null,
    visible: null,
  }
}

function mergeRelationships(target: Record<string, string[]>, source: Record<string, string[] | null> | null): void {
  if (!source) return
  for (const [key, value] of Object.entries(source)) {
    if (Array.isArray(value) && value.length > 0) Reflect.set(target, key, value)
  }
}

function mergeProperties(
  target: Record<string, VaultPropertyValue>,
  source: PropertiesPatch | null,
): void {
  if (!source) return
  for (const [key, value] of Object.entries(source)) {
    if (value !== null) Reflect.set(target, key, value)
  }
}

export function deriveRawEditorEntryState(content: string): Partial<VaultEntry> {
  const derived = createRawEditorEntryState()
  const properties: Record<string, VaultPropertyValue> = {}
  const relationships: Record<string, string[]> = {}

  for (const [key, value] of Object.entries(parseFrontmatter(content))) {
    const { patch, relationshipPatch, propertiesPatch } = frontmatterToEntryPatch('update', key, value)
    Object.assign(derived, patch)
    mergeRelationships(relationships, relationshipPatch)
    mergeProperties(properties, propertiesPatch)
  }

  derived.properties = properties
  derived.relationships = relationships
  if (derived.isA === 'Type' && derived.template === null) {
    derived.template = bodyTemplate(content)
  }
  return derived
}

export function deriveLiveTypeTemplatePatch(content: string): Pick<VaultEntry, 'template'> | null {
  const [frontmatter] = splitFrontmatter(content)
  if (!TYPE_DOCUMENT_FRONTMATTER.test(frontmatter)) return null

  const state = deriveRawEditorEntryState(content)
  return state.isA === 'Type' ? { template: state.template ?? null } : null
}
