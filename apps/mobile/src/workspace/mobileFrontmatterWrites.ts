import type {
  LocalVaultFrontmatter,
  LocalVaultFrontmatterValue,
} from './localVaultFrontmatter'
import {
  parseLocalVaultDocument,
  serializeLocalVaultFrontmatterKey,
  serializeLocalVaultFrontmatterScalar,
} from './localVaultFrontmatter'

type FrontmatterKey = string

type CanonicalFrontmatterWriteRule = {
  aliases: readonly FrontmatterKey[]
  /** Keep an existing alias key as it is cased in the note; `writeKey` applies only to new keys (TOL-466). */
  keepsExistingKey?: boolean
  writeKey: FrontmatterKey
}

const canonicalFrontmatterWriteRules: readonly CanonicalFrontmatterWriteRule[] = [
  { aliases: ['type', 'is_a', 'Is A'], writeKey: 'type' },
  { aliases: ['status', 'Status'], keepsExistingKey: true, writeKey: 'status' },
  { aliases: ['tags', 'Tags'], keepsExistingKey: true, writeKey: 'tags' },
  { aliases: ['title', 'Title'], writeKey: 'title' },
  { aliases: ['_archived', 'Archived', 'archived'], writeKey: '_archived' },
  { aliases: ['_favorite', 'favorite'], writeKey: '_favorite' },
  { aliases: ['_favorite_index', 'favorite_index', 'favorite index'], writeKey: '_favorite_index' },
  { aliases: ['_icon', 'icon'], writeKey: '_icon' },
  { aliases: ['_order', 'order'], writeKey: '_order' },
  { aliases: ['_sidebar_label', 'sidebar_label', 'sidebar label'], writeKey: '_sidebar_label' },
  { aliases: ['_sort', 'sort'], writeKey: '_sort' },
  { aliases: ['_width', 'width'], writeKey: '_width' },
]

export const writeMobileFrontmatterValue = (
  frontmatter: LocalVaultFrontmatter,
  key: FrontmatterKey,
  value: LocalVaultFrontmatterValue | undefined,
): LocalVaultFrontmatter => {
  const rule = canonicalFrontmatterWriteRule(key)
  const writeKey = rule ? ruleWriteKey(frontmatter, rule) : key
  const frontmatterWithoutAliases = rule
    ? deleteFrontmatterAliases(frontmatter, rule, writeKey)
    : { ...frontmatter }

  const nextFrontmatter = { ...frontmatterWithoutAliases }
  if (shouldRemoveFrontmatterValue(value)) {
    Reflect.deleteProperty(nextFrontmatter, writeKey)
    return nextFrontmatter
  }

  nextFrontmatter[writeKey] = value as LocalVaultFrontmatterValue
  return nextFrontmatter
}

export function writeMobileFrontmatterContentValue(
  content: string,
  key: FrontmatterKey,
  value: LocalVaultFrontmatterValue | undefined,
): string {
  const document = parseLocalVaultDocument(content)
  return serializeMobileLocalVaultDocument(
    writeMobileFrontmatterValue(document.frontmatter, key, value),
    document.body,
  )
}

export function serializeMobileLocalVaultDocument(
  frontmatter: LocalVaultFrontmatter,
  body: string,
): string {
  const entries = Object.entries(frontmatter).filter(([, value]) => value !== null && value !== undefined)
  if (entries.length === 0) return body

  return `---\n${entries.map(([key, value]) => serializeFrontmatterEntry(key, value)).join('\n')}\n---\n${body}`
}

function canonicalFrontmatterWriteRule(
  key: FrontmatterKey,
): CanonicalFrontmatterWriteRule | null {
  const normalizedKey = normalizedFrontmatterKey(key)
  return canonicalFrontmatterWriteRules.find((rule) => {
    return rule.aliases.some((alias) => normalizedFrontmatterKey(alias) === normalizedKey)
  }) ?? null
}

function matchesRuleAlias(rule: CanonicalFrontmatterWriteRule, key: FrontmatterKey): boolean {
  return rule.aliases.some((alias) => normalizedFrontmatterKey(alias) === normalizedFrontmatterKey(key))
}

function ruleWriteKey(frontmatter: LocalVaultFrontmatter, rule: CanonicalFrontmatterWriteRule): FrontmatterKey {
  if (!rule.keepsExistingKey) return rule.writeKey
  return Object.keys(frontmatter).find((key) => matchesRuleAlias(rule, key)) ?? rule.writeKey
}

function deleteFrontmatterAliases(
  frontmatter: LocalVaultFrontmatter,
  rule: CanonicalFrontmatterWriteRule,
  keptKey: FrontmatterKey,
): LocalVaultFrontmatter {
  const nextFrontmatter = { ...frontmatter }
  for (const key of Object.keys(frontmatter)) {
    if (key !== keptKey && matchesRuleAlias(rule, key)) {
      Reflect.deleteProperty(nextFrontmatter, key)
    }
  }
  return nextFrontmatter
}

function shouldRemoveFrontmatterValue(
  value: LocalVaultFrontmatterValue | undefined,
): boolean {
  return value === undefined || value === null || (Array.isArray(value) && value.length === 0)
}

function normalizedFrontmatterKey(key: FrontmatterKey): FrontmatterKey {
  return key.trim().toLowerCase().replaceAll(' ', '_')
}

function serializeFrontmatterEntry(
  key: FrontmatterKey,
  value: LocalVaultFrontmatterValue,
): string {
  const frontmatterKey = serializeLocalVaultFrontmatterKey(key)
  if (Array.isArray(value)) {
    return `${frontmatterKey}:\n${value.map((item) => `  - ${serializeLocalVaultFrontmatterScalar(item)}`).join('\n')}`
  }

  return `${frontmatterKey}: ${serializeLocalVaultFrontmatterScalar(value)}`
}
