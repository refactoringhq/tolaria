import { deriveEditableNote, type DerivedNote, type EditableNoteInput } from './mobileEditableNote'
import { parseLocalVaultDocument, serializeLocalVaultFrontmatterKey, serializeLocalVaultFrontmatterScalar, type LocalVaultFrontmatter, type LocalVaultFrontmatterValue } from './localVaultFrontmatter'
import type { MobileNote, MobileTypeDefinitions } from './mobileWorkspaceModel'
import { writeMobileFrontmatterValue } from './mobileFrontmatterWrites'
import { mobileRelationshipRefValue, preservedMobileSourceFrontmatterMetadata } from './mobileSourceFrontmatterMetadata'
import { hasMobileSourceFrontmatterIssue } from './mobileSourceFrontmatterValidation'
import { canApplyMobileMarkdownEdit, mobileTextFileNoteWithContent } from './mobileTextFileEditing'
import { relationshipFrontmatterKey as sharedRelationshipFrontmatterKey } from '../../../../src/utils/relationshipKeys'
import type { FrontmatterKey, MarkdownContent, NoteTitle } from './mobileWorkspaceEditing.types'

export function deriveMobileNote(note: MobileNote, typeDefinitions?: MobileTypeDefinitions): DerivedNote | null {
  if (note.rawContent === undefined) return null
  if (note.fileKind === 'text') {
    return {
      note: mobileTextFileNoteWithContent(note, note.rawContent),
      rawRelationships: {},
    }
  }
  if (!canApplyMobileMarkdownEdit(note)) return null

  const editable = withEditableContent(note)
  if (hasMobileSourceFrontmatterIssue(editable.rawContent)) {
    return preservedMobileSourceFrontmatterMetadata(editable)
  }

  return deriveEditableNote({ fallback: editable, rawContent: editable.rawContent, typeDefinitions })
}

export function deriveEditedNote(
  fallback: EditableNoteInput,
  rawContent: MarkdownContent,
  typeDefinitions?: MobileTypeDefinitions,
): MobileNote {
  if (hasMobileSourceFrontmatterIssue(rawContent)) {
    return preservedMobileSourceFrontmatterMetadata({ ...fallback, rawContent }).note
  }

  return deriveEditableNote({ fallback, rawContent, typeDefinitions }).note
}

export function withEditableContent(note: MobileNote): EditableNoteInput {
  return {
    ...note,
    rawContent: note.rawContent ?? fallbackMarkdownContent(note),
  }
}

export function fallbackMarkdownContent(note: MobileNote): MarkdownContent {
  const snippet = note.snippet.trim()
  const body = snippet ? `# ${note.title}\n\n${snippet}\n` : `# ${note.title}\n\n`
  return serializeDocument(fallbackFrontmatter(note), body)
}

export function fallbackFrontmatter(note: MobileNote): LocalVaultFrontmatter {
  const frontmatter = fallbackMetadataFrontmatter(note)
  mergeFrontmatter(frontmatter, fallbackPropertyFrontmatter(note))
  mergeFrontmatter(frontmatter, fallbackRelationshipFrontmatter(note))
  return frontmatter
}

export function mergeFrontmatter(target: LocalVaultFrontmatter, source: LocalVaultFrontmatter) {
  for (const [key, value] of Object.entries(source)) {
    target[key] = value
  }
}

export function fallbackMetadataFrontmatter(note: MobileNote): LocalVaultFrontmatter {
  const frontmatter: LocalVaultFrontmatter = {}
  addFrontmatterValue(frontmatter, 'type', fallbackTypeValue(note))
  addFrontmatterValue(frontmatter, 'status', note.status)
  addFrontmatterValue(frontmatter, 'aliases', nonEmptyStringList(note.aliases))
  addFrontmatterValue(frontmatter, 'tags', nonEmptyStringList(note.tags))
  addFrontmatterValue(frontmatter, '_favorite', trueFlagValue(note.favorite))
  addFrontmatterValue(frontmatter, '_favorite_index', favoriteIndexValue(note.favoriteIndex))
  addFrontmatterValue(frontmatter, '_archived', trueFlagValue(note.archived))
  addFrontmatterValue(frontmatter, '_organized', trueFlagValue(note.organized))
  return frontmatter
}

export function fallbackTypeValue(note: MobileNote): string | undefined {
  return note.type && note.type !== 'Note' ? note.type : undefined
}

export function nonEmptyStringList(values: string[] | undefined): string[] | undefined {
  return values && values.length > 0 ? values : undefined
}

export function trueFlagValue(value: boolean | undefined): true | undefined {
  return value ? true : undefined
}

export function favoriteIndexValue(value: number | null | undefined): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined
}

export function fallbackPropertyFrontmatter(note: MobileNote): LocalVaultFrontmatter {
  return Object.fromEntries((note.properties ?? []).map((property) => [property.key, property.value]))
}

export function fallbackRelationshipFrontmatter(note: MobileNote): LocalVaultFrontmatter {
  const frontmatter: LocalVaultFrontmatter = {}
  for (const relationship of note.relationships) {
    frontmatter[sharedRelationshipFrontmatterKey(relationship)] = relationship.values.map(mobileRelationshipRefValue)
  }
  return frontmatter
}

export function addFrontmatterValue(
  frontmatter: LocalVaultFrontmatter,
  key: FrontmatterKey,
  value: LocalVaultFrontmatterValue | undefined,
) {
  if (value !== undefined && value !== '') frontmatter[key] = value
}

export function writeFrontmatterValue(
  content: MarkdownContent,
  key: FrontmatterKey,
  value: LocalVaultFrontmatterValue | undefined,
): MarkdownContent {
  const document = parseLocalVaultDocument(content)
  const nextFrontmatter = writeMobileFrontmatterValue(document.frontmatter, key, value)
  return serializeDocument(nextFrontmatter, document.body)
}

export function serializeDocument(frontmatter: LocalVaultFrontmatter, body: MarkdownContent): MarkdownContent {
  const entries = Object.entries(frontmatter).filter(([, value]) => value !== null && value !== undefined)
  if (entries.length === 0) return body

  const frontmatterText = entries
    .map(([key, value]) => serializeFrontmatterEntry(key, value))
    .join('\n')

  return `---\n${frontmatterText}\n---\n${body}`
}

export function serializeFrontmatterEntry(key: FrontmatterKey, value: LocalVaultFrontmatterValue): string {
  const frontmatterKey = serializeLocalVaultFrontmatterKey(key)
  if (Array.isArray(value)) {
    return `${frontmatterKey}:\n${value.map((item) => `  - ${serializeLocalVaultFrontmatterScalar(item)}`).join('\n')}`
  }

  return `${frontmatterKey}: ${serializeLocalVaultFrontmatterScalar(value)}`
}

export function slugifyTitle(title: NoteTitle): string {
  return title
    .trim()
    .toLowerCase()
    .replace(/['"]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || 'untitled'
}

export function absoluteDate(timestamp: number): string {
  return new Intl.DateTimeFormat('en', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(timestamp))
}
