import type { FrontmatterValue } from '../components/Inspector'

export interface ParsedFrontmatter {
  [key: string]: FrontmatterValue
}

function unquote(s: string): string {
  return s.replace(/^["']|["']$/g, '')
}

function collapseList(items: string[]): FrontmatterValue {
  return items.length === 1 ? items[0] : items
}

function isBlockScalar(value: string): boolean {
  return value === '' || value === '|' || value === '>'
}

function parseInlineArray(value: string): FrontmatterValue {
  const items = value.slice(1, -1).split(',').map(s => unquote(s.trim()))
  return collapseList(items)
}

function parseScalar(value: string): FrontmatterValue {
  const clean = unquote(value)
  const lower = clean.toLowerCase()
  if (lower === 'true' || lower === 'yes') return true
  if (lower === 'false' || lower === 'no') return false
  return clean
}

/** Parse YAML frontmatter from content */
export function parseFrontmatter(content: string | null): ParsedFrontmatter {
  if (!content) return {}
  const match = content.match(/^---\n([\s\S]*?)\n---/)
  if (!match) return {}

  const result: ParsedFrontmatter = {}
  let currentKey: string | null = null
  let currentList: string[] = []
  let inList = false

  for (const line of match[1].split('\n')) {
    const listMatch = line.match(/^ {2}- (.*)$/)
    if (listMatch && currentKey) {
      inList = true
      currentList.push(unquote(listMatch[1]))
      continue
    }

    if (inList && currentKey) {
      result[currentKey] = collapseList(currentList)
      currentList = []
      inList = false
    }

    const kvMatch = line.match(/^["']?([^"':]+)["']?\s*:\s*(.*)$/)
    if (!kvMatch) continue
    currentKey = kvMatch[1].trim()
    const value = kvMatch[2].trim()

    if (isBlockScalar(value)) continue
    if (value.startsWith('[') && value.endsWith(']')) { result[currentKey] = parseInlineArray(value); continue }
    result[currentKey] = parseScalar(value)
  }

  if (inList && currentKey) result[currentKey] = collapseList(currentList)
  return result
}
