import path from 'path'
import fs from 'fs'
import type { Plugin } from 'vite'
import type { IncomingMessage, ServerResponse } from 'http'
import matter from 'gray-matter'

interface VaultEntry {
  path: string
  filename: string
  title: string
  isA: string | null
  aliases: string[]
  belongsTo: string[]
  relatedTo: string[]
  status: string | null
  owner: string | null
  cadence: string | null
  modifiedAt: number | null
  createdAt: number | null
  fileSize: number
  snippet: string
  relationships: Record<string, string[]>
}

/** Extract all [[wiki-links]] from a string. */
function extractWikiLinks(value: string): string[] {
  const matches = value.match(/\[\[[^\]]+\]\]/g)
  return matches ?? []
}

/** Extract wiki-links from a frontmatter value (string or array of strings). */
function wikiLinksFromValue(value: unknown): string[] {
  if (typeof value === 'string') return extractWikiLinks(value)
  if (Array.isArray(value)) {
    return value.flatMap((v) => (typeof v === 'string' ? extractWikiLinks(v) : []))
  }
  return []
}

// Frontmatter keys that map to dedicated VaultEntry fields (skip in generic relationships)
const DEDICATED_KEYS = new Set([
  'aliases', 'is_a', 'is a', 'belongs_to', 'belongs to',
  'related_to', 'related to', 'status', 'owner', 'cadence',
  'created_at', 'created at', 'title',
])

type Frontmatter = Record<string, unknown>

/** Case-insensitive lookup for a string-valued frontmatter field. */
function getFmString(fm: Frontmatter, ...keys: string[]): string | null {
  for (const k of keys) {
    for (const fk of Object.keys(fm)) {
      if (fk.toLowerCase() === k.toLowerCase() && typeof fm[fk] === 'string') {
        return fm[fk] as string
      }
    }
  }
  return null
}

/** Case-insensitive lookup for an array-of-strings frontmatter field. */
function getFmArray(fm: Frontmatter, ...keys: string[]): string[] {
  for (const k of keys) {
    for (const fk of Object.keys(fm)) {
      if (fk.toLowerCase() === k.toLowerCase()) {
        const val = fm[fk]
        if (Array.isArray(val)) return val.map(String)
        if (typeof val === 'string') return [val]
      }
    }
  }
  return []
}

/** Extract generic relationships: any frontmatter key whose value contains wiki-links. */
function extractRelationships(fm: Frontmatter): Record<string, string[]> {
  const relationships: Record<string, string[]> = {}
  for (const key of Object.keys(fm)) {
    if (DEDICATED_KEYS.has(key.toLowerCase())) continue
    const links = wikiLinksFromValue(fm[key])
    if (links.length > 0) relationships[key] = links
  }
  return relationships
}

/** Parse a date string to unix milliseconds, or null if invalid. */
function parseDateToMs(raw: string | null): number | null {
  if (!raw) return null
  const d = new Date(raw)
  return isNaN(d.getTime()) ? null : d.getTime()
}

function parseMarkdownFile(filePath: string): VaultEntry | null {
  try {
    const raw = fs.readFileSync(filePath, 'utf-8')
    const stats = fs.statSync(filePath)
    const { data: fm, content } = matter(raw)

    const filename = path.basename(filePath)
    const basename = filename.replace(/\.md$/, '')

    const h1Match = content.match(/^#\s+(.+)$/m)
    const title = (fm.title as string) || (h1Match ? h1Match[1].trim() : basename)

    const belongsTo = getFmArray(fm, 'belongs_to', 'belongs to').flatMap(extractWikiLinks)
    const relatedTo = getFmArray(fm, 'related_to', 'related to').flatMap(extractWikiLinks)

    const bodyText = content.replace(/^#+\s+.+$/gm, '').replace(/[\n\r]+/g, ' ').trim()

    return {
      path: filePath,
      filename,
      title,
      isA: getFmString(fm, 'is_a', 'is a'),
      aliases: getFmArray(fm, 'aliases'),
      belongsTo,
      relatedTo,
      status: getFmString(fm, 'status'),
      owner: getFmString(fm, 'owner'),
      cadence: getFmString(fm, 'cadence'),
      modifiedAt: stats.mtimeMs,
      createdAt: parseDateToMs(getFmString(fm, 'created_at', 'created at')),
      fileSize: stats.size,
      snippet: bodyText.slice(0, 200),
      relationships: extractRelationships(fm),
    }
  } catch {
    return null
  }
}

/** Recursively find all .md files under a directory. */
function findMarkdownFiles(dir: string): string[] {
  const results: string[] = []
  try {
    const items = fs.readdirSync(dir, { withFileTypes: true })
    for (const item of items) {
      if (item.name.startsWith('.')) continue
      const full = path.join(dir, item.name)
      if (item.isDirectory()) {
        results.push(...findMarkdownFiles(full))
      } else if (item.name.endsWith('.md')) {
        results.push(full)
      }
    }
  } catch {
    // skip unreadable dirs
  }
  return results
}

/** Send a JSON error response. */
function sendError(res: ServerResponse, status: number, message: string): void {
  res.statusCode = status
  res.end(JSON.stringify({ error: message }))
}

/** Send a JSON success response. */
function sendJson(res: ServerResponse, data: unknown): void {
  res.setHeader('Content-Type', 'application/json')
  res.end(JSON.stringify(data))
}

/** Validate a path query param exists and points to an existing location. */
function getValidPath(url: URL, param: string): string | null {
  const p = url.searchParams.get(param)
  return (p && fs.existsSync(p)) ? p : null
}

function handlePing(_req: IncomingMessage, res: ServerResponse): void {
  sendJson(res, { ok: true })
}

function handleList(url: URL, res: ServerResponse): void {
  const dirPath = getValidPath(url, 'path')
  if (!dirPath) return sendError(res, 400, 'Invalid or missing path')
  const files = findMarkdownFiles(dirPath)
  const entries = files.map(parseMarkdownFile).filter(Boolean)
  sendJson(res, entries)
}

function handleContent(url: URL, res: ServerResponse): void {
  const filePath = getValidPath(url, 'path')
  if (!filePath) return sendError(res, 400, 'Invalid or missing path')
  const content = fs.readFileSync(filePath, 'utf-8')
  sendJson(res, { content })
}

function handleAllContent(url: URL, res: ServerResponse): void {
  const dirPath = getValidPath(url, 'path')
  if (!dirPath) return sendError(res, 400, 'Invalid or missing path')
  const files = findMarkdownFiles(dirPath)
  const contentMap: Record<string, string> = {}
  for (const f of files) {
    try { contentMap[f] = fs.readFileSync(f, 'utf-8') } catch { /* skip */ }
  }
  sendJson(res, contentMap)
}

const ROUTE_HANDLERS: Record<string, (url: URL, req: IncomingMessage, res: ServerResponse) => void> = {
  '/api/vault/ping': (_url, req, res) => handlePing(req, res),
  '/api/vault/list': (url, _req, res) => handleList(url, res),
  '/api/vault/content': (url, _req, res) => handleContent(url, res),
  '/api/vault/all-content': (url, _req, res) => handleAllContent(url, res),
}

export function vaultApiPlugin(): Plugin {
  return {
    name: 'vault-api',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = new URL(req.url ?? '/', `http://${req.headers.host}`)
        const handler = ROUTE_HANDLERS[url.pathname]
        if (handler) return handler(url, req, res)
        next()
      })
    },
  }
}
