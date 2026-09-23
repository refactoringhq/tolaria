import type { VaultEntry } from '../types'
import { countWords, extractOutgoingLinks, extractSnippet } from '../utils/wikilinks'

export interface EditorEntryMetadataRequest {
  content: string
  includeSavedMetadata: boolean
  path: string
}

export type EditorEntryContentMetadata = Pick<
  VaultEntry,
  'modifiedAt' | 'outgoingLinks' | 'snippet' | 'wordCount'
>

export function deriveEditorEntryContentMetadata(
  request: EditorEntryMetadataRequest,
): Partial<EditorEntryContentMetadata> & Pick<VaultEntry, 'outgoingLinks' | 'wordCount'> {
  const { content, includeSavedMetadata } = request
  const metadata: Partial<EditorEntryContentMetadata> & Pick<VaultEntry, 'outgoingLinks' | 'wordCount'> = {
    outgoingLinks: content.includes('[[') ? extractOutgoingLinks(content) : [],
    wordCount: countWords(content),
  }
  if (!includeSavedMetadata) return metadata

  return {
    ...metadata,
    snippet: extractSnippet(content),
    modifiedAt: Math.floor(Date.now() / 1000),
  }
}
