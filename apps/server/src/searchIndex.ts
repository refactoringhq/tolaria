import type { VaultEntry } from '../../../packages/vault-index/src/index.ts'
import type { SearchResponse, SearchResult } from '../../../packages/protocol/src/index.ts'
import type { BlobStore } from './store.ts'
import type { Vault } from './vault.ts'
import type { VaultChange } from './gitSync.ts'
import type { VaultPath } from './paths.ts'
import { putByPath, removeByPath, sortByPath } from './pathOrder.ts'
import { DeferredWrite, INDEX_WRITE_DELAY_MS, type IndexFormat, type IndexParts, readStoredIndex, type StoredIndex, writeIndex } from './storedIndex.ts'

export const INDEX_KEY = 'search-index.json'
const FORMAT: IndexFormat = { key: INDEX_KEY, version: 1, name: 'search index', items: 'notes' }
/** Above this many changed files since the stored index, a rebuild is about as fast. */
const CATCH_UP_LIMIT = 500
const MAX_SNIPPET_CHARS = 300
const MATCHES_PER_FILE = 3

interface IndexedNote {
  path: string
  title: string
  /** Lowercase searchable content for fast matching */
  contentLower: string
  /** Original content for snippet extraction */
  content: string
}

interface SearchHit {
  path: string
  title: string
  titleMatch: boolean
  contentMatches: Array<{ pos: number; line: number }>
  score: number
}

function isMarkdownNote(path: string): boolean {
  return path.toLowerCase().endsWith('.md') && !path.split('/').some((seg) => seg.startsWith('.'))
}

const FENCE = /^```/

/** Where a line of a note is, as the scan for searchable text goes down the note. */
type Section = 'frontmatter' | 'code' | 'text'

/** One line of a note, and whether it is the note's first. */
interface NoteLine {
  text: string
  first: boolean
}

/** The section after `line`, which is itself searchable only when this returns null. */
function nextSection(section: Section, line: NoteLine): Section | null {
  const delimiter = line.text.trim() === '---'
  if (section === 'frontmatter') return delimiter ? 'text' : 'frontmatter'
  if (FENCE.test(line.text)) return section === 'code' ? 'text' : 'code'
  if (section === 'code') return 'code'
  return line.first && delimiter ? 'frontmatter' : null
}

/** The note's text without its frontmatter and fenced code blocks. */
function extractSearchableContent(entry: Pick<VaultEntry, 'fileKind'>, content: string): string {
  if (entry.fileKind !== 'markdown') return content
  let section: Section = 'text'
  const searchable: string[] = []
  for (const [index, text] of content.split(/\r?\n/).entries()) {
    const next = nextSection(section, { text, first: index === 0 })
    if (next === null) searchable.push(text)
    else section = next
  }
  return searchable.join('\n')
}

function calculateScore(hit: SearchHit, queryLower: string): number {
  let score = 0
  
  const titleLower = hit.title.toLowerCase()
  const titleWords = titleLower.split(/\s+/)
  
  if (titleWords.includes(queryLower)) {
    score += 10.0
  } else if (titleLower.includes(queryLower)) {
    score += 5.0
  }
  
  const contentMatchCount = Math.min(hit.contentMatches.length, 20)
  score += contentMatchCount * 0.5
  
  return score
}

function extractSnippet(content: string, matchPos: number): string {
  const lines = content.split(/\r?\n/)
  let currentPos = 0
  
  for (const line of lines) {
    const lineEnd = currentPos + line.length + 1
    if (matchPos >= currentPos && matchPos < lineEnd) {
      const trimmed = line.trim()
      if (trimmed.length > MAX_SNIPPET_CHARS) {
        return `${trimmed.slice(0, MAX_SNIPPET_CHARS)}…`
      }
      return trimmed
    }
    currentPos = lineEnd
  }
  
  const contextStart = Math.max(0, matchPos - 60)
  const contextEnd = Math.min(content.length, matchPos + 120)
  let snippet = content.slice(contextStart, contextEnd).trim()
  
  if (snippet.length > MAX_SNIPPET_CHARS) {
    snippet = `${snippet.slice(0, MAX_SNIPPET_CHARS)}…`
  }
  
  return snippet
}

function findMatches(contentLower: string, queryLower: string): Array<{ pos: number; line: number }> {
  const matches: Array<{ pos: number; line: number }> = []
  let pos = 0
  const maxMatches = 20
  
  while (pos < contentLower.length && matches.length < maxMatches) {
    const found = contentLower.indexOf(queryLower, pos)
    if (found === -1) break
    
    let line = 1
    for (let i = 0; i < found; i++) {
      if (contentLower[i] === '\n') line++
    }
    
    matches.push({ pos: found, line })
    pos = found + queryLower.length
  }
  
  return matches
}

/**
 * In-memory search index for vault notes. Provides fast case-insensitive search with
 * ranking and snippet extraction matching desktop search behavior.
 */
export class SearchIndex {
  private readonly vault: Vault
  private readonly store: BlobStore
  private readonly persist: DeferredWrite
  private head: string
  private notes: IndexedNote[]
  private dirty = false

  private constructor({ vault, store, log }: IndexParts, { head, items }: StoredIndex<IndexedNote>) {
    this.vault = vault
    this.store = store
    this.head = head
    this.notes = sortByPath(items)
    this.persist = new DeferredWrite({ write: () => this.save(), delayMs: INDEX_WRITE_DELAY_MS, log })
  }

  /** Loads the stored index and brings it up to the vault's head, or builds it, as `VaultIndex.open` does. */
  static async open(vault: Vault, store: BlobStore, log: (message: string) => void = () => {}): Promise<SearchIndex> {
    const parts = { vault, store, log }
    const currentHead = await vault.head()
    const stored = await readStoredIndex<IndexedNote>(store, FORMAT, log)
    if (stored) {
      const index = new SearchIndex(parts, stored)
      if (stored.head === currentHead) return index
      const changes = await vault.changesSince(stored.head, CATCH_UP_LIMIT)
      if (changes) {
        await index.catchUp(currentHead, changes)
        log(`search index caught up with ${changes.length} changed file(s)`)
        return index
      }
    }
    const index = new SearchIndex(parts, { head: currentHead, items: await SearchIndex.buildFromVault(vault) })
    index.dirty = true
    await index.save()
    return index
  }

  private static async buildFromVault(vault: Vault): Promise<IndexedNote[]> {
    const { files } = await vault.list()
    const notes: IndexedNote[] = []
    
    for (const file of files) {
      if (!isMarkdownNote(file.path)) continue
      
      try {
        const { bytes } = await vault.read(file.path as VaultPath)
        const content = bytes.toString('utf8')
        const title = extractTitle({ content, path: file.path })
        const searchable = extractSearchableContent({ fileKind: 'markdown' } as Pick<VaultEntry, 'fileKind'>, content)
        
        notes.push({
          path: file.path,
          title,
          contentLower: searchable.toLowerCase(),
          content,
        })
      } catch {
        // Skip files that can't be read
      }
    }
    
    return notes
  }

  async search(query: string, limit: number): Promise<SearchResponse> {
    const queryLower = query.toLowerCase()
    const hits: SearchHit[] = []
    
    for (const note of this.notes) {
      const titleMatch = note.title.toLowerCase().includes(queryLower)
      const contentMatches = findMatches(note.contentLower, queryLower)
      
      if (!titleMatch && contentMatches.length === 0) continue
      
      hits.push({
        path: note.path,
        title: note.title,
        titleMatch,
        contentMatches,
        score: 0,
      })
    }
    
    for (const hit of hits) {
      hit.score = calculateScore(hit, queryLower)
    }
    
    hits.sort((a, b) => b.score - a.score)
    const topHits = hits.slice(0, limit)
    
    const results: SearchResult[] = topHits.map((hit) => {
      const pathMatch = hit.path.toLowerCase().includes(queryLower)
      const matches = hit.contentMatches.slice(0, MATCHES_PER_FILE).map((match) => {
        const note = this.notes.find((n) => n.path === hit.path)
        if (!note) throw new Error(`Note not found: ${hit.path}`)
        const snippet = extractSnippet(note.content, match.pos)
        return { line: match.line, text: snippet }
      })
      
      return { path: hit.path, pathMatch, matches }
    })
    
    return { results, truncated: hits.length > limit }
  }

  /** Updates the index from vault changes; the store copy follows later. */
  async apply(changes: VaultChange[]): Promise<void> {
    if (changes.length === 0) return
    this.head = await this.vault.head()
    await this.applyEach(changes)
    if (this.dirty) this.persist.schedule()
  }

  /** Writes the index to the store now, if it changed since the last write. */
  flush(): Promise<void> {
    return this.persist.flush()
  }

  private async catchUp(head: string, changes: VaultChange[]): Promise<void> {
    this.head = head
    this.dirty = true
    await this.applyEach(changes)
    await this.save()
  }

  private async applyEach(changes: VaultChange[]): Promise<void> {
    for (const change of changes) {
      if (change.kind === 'upsert') {
        await this.updateNote(change.path)
      } else if (change.kind === 'delete') {
        this.removeNote(change.path)
      } else {
        this.removeNote(change.from)
        await this.updateNote(change.to)
      }
    }
  }

  private async updateNote(path: VaultPath): Promise<void> {
    if (!isMarkdownNote(path)) {
      this.removeNote(path)
      return
    }
    
    try {
      const { bytes } = await this.vault.read(path)
      const content = bytes.toString('utf8')
      const title = extractTitle({ content, path })
      const searchable = extractSearchableContent({ fileKind: 'markdown' } as Pick<VaultEntry, 'fileKind'>, content)
      
      putByPath(this.notes, { path, title, contentLower: searchable.toLowerCase(), content })
      this.dirty = true
    } catch {
      this.removeNote(path)
    }
  }

  private removeNote(path: VaultPath): void {
    if (removeByPath(this.notes, path)) this.dirty = true
  }

  private async save(): Promise<void> {
    if (!this.dirty) return
    this.dirty = false
    await writeIndex(this.store, FORMAT, { head: this.head, items: this.notes }).catch((error: unknown) => {
      this.dirty = true
      throw error
    })
  }
}

function extractTitle({ content, path }: { content: string; path: string }): string {
  const lines = content.split(/\r?\n/)
  
  for (const line of lines) {
    if (line.trim() === '' || line.trim().startsWith('---')) continue
    const h1Match = line.match(/^#\s+(.+)/)
    if (h1Match) return h1Match[1].trim()
  }
  
  const filename = path.split('/').pop() || path
  return filename.replace(/\.md$/i, '').replace(/[-_]/g, ' ')
}
