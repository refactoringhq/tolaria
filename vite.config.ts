/// <reference types="vitest/config" />
import path from 'path'
import fs from 'fs'
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import matter from 'gray-matter'

// --- Vault API middleware (dev only) ---

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

function parseMarkdownFile(filePath: string): VaultEntry | null {
  try {
    const raw = fs.readFileSync(filePath, 'utf-8')
    const stats = fs.statSync(filePath)
    const { data: fm, content } = matter(raw)

    const filename = path.basename(filePath)
    const basename = filename.replace(/\.md$/, '')

    // Title: first H1 in body, or frontmatter title, or filename
    const h1Match = content.match(/^#\s+(.+)$/m)
    const title = (fm.title as string) || (h1Match ? h1Match[1].trim() : basename)

    // Helper to get a frontmatter string field (case-insensitive key)
    const getString = (...keys: string[]): string | null => {
      for (const k of keys) {
        for (const fk of Object.keys(fm)) {
          if (fk.toLowerCase() === k.toLowerCase() && typeof fm[fk] === 'string') {
            return fm[fk]
          }
        }
      }
      return null
    }

    // Helper to get a frontmatter array-of-strings field
    const getArray = (...keys: string[]): string[] => {
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

    const aliases = getArray('aliases')
    const belongsToRaw = getArray('belongs_to', 'belongs to')
    const relatedToRaw = getArray('related_to', 'related to')
    const belongsTo = belongsToRaw.flatMap((v) => extractWikiLinks(v))
    const relatedTo = relatedToRaw.flatMap((v) => extractWikiLinks(v))

    // Created at → unix ms
    const createdAtRaw = getString('created_at', 'created at')
    let createdAt: number | null = null
    if (createdAtRaw) {
      const d = new Date(createdAtRaw)
      if (!isNaN(d.getTime())) createdAt = d.getTime()
    }

    // Snippet: first 200 chars of body after frontmatter, stripped of markdown
    const bodyText = content.replace(/^#+\s+.+$/gm, '').replace(/[\n\r]+/g, ' ').trim()
    const snippet = bodyText.slice(0, 200)

    // Generic relationships: any frontmatter key whose value contains wiki-links
    const relationships: Record<string, string[]> = {}
    for (const key of Object.keys(fm)) {
      if (DEDICATED_KEYS.has(key.toLowerCase())) continue
      const links = wikiLinksFromValue(fm[key])
      if (links.length > 0) {
        relationships[key] = links
      }
    }

    return {
      path: filePath,
      filename,
      title,
      isA: getString('is_a', 'is a'),
      aliases,
      belongsTo,
      relatedTo,
      status: getString('status'),
      owner: getString('owner'),
      cadence: getString('cadence'),
      modifiedAt: stats.mtimeMs,
      createdAt,
      fileSize: stats.size,
      snippet,
      relationships,
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

function vaultApiPlugin(): Plugin {
  return {
    name: 'vault-api',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = new URL(req.url ?? '/', `http://${req.headers.host}`)

        if (url.pathname === '/api/vault/ping') {
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ ok: true }))
          return
        }

        if (url.pathname === '/api/vault/list') {
          const dirPath = url.searchParams.get('path')
          if (!dirPath || !fs.existsSync(dirPath)) {
            res.statusCode = 400
            res.end(JSON.stringify({ error: 'Invalid or missing path' }))
            return
          }
          const files = findMarkdownFiles(dirPath)
          const entries = files.map(parseMarkdownFile).filter(Boolean)
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify(entries))
          return
        }

        if (url.pathname === '/api/vault/content') {
          const filePath = url.searchParams.get('path')
          if (!filePath || !fs.existsSync(filePath)) {
            res.statusCode = 400
            res.end(JSON.stringify({ error: 'Invalid or missing path' }))
            return
          }
          const content = fs.readFileSync(filePath, 'utf-8')
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ content }))
          return
        }

        if (url.pathname === '/api/vault/all-content') {
          const dirPath = url.searchParams.get('path')
          if (!dirPath || !fs.existsSync(dirPath)) {
            res.statusCode = 400
            res.end(JSON.stringify({ error: 'Invalid or missing path' }))
            return
          }
          const files = findMarkdownFiles(dirPath)
          const contentMap: Record<string, string> = {}
          for (const f of files) {
            try {
              contentMap[f] = fs.readFileSync(f, 'utf-8')
            } catch {
              // skip unreadable files
            }
          }
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify(contentMap))
          return
        }

        next()
      })
    },
  }
}

// --- AI Chat proxy helpers ---

function readRequestBody(req: import('http').IncomingMessage): Promise<string> {
  return new Promise((resolve) => {
    let body = ''
    req.on('data', (chunk: Buffer) => { body += chunk.toString() })
    req.on('end', () => resolve(body))
  })
}

async function forwardToAnthropic(params: {
  apiKey: string; model?: string; messages: { role: string; content: string }[]; system?: string; maxTokens?: number
}): Promise<Response> {
  return fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': params.apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: params.model || 'claude-3-5-haiku-20241022',
      max_tokens: params.maxTokens || 4096,
      system: params.system || undefined,
      messages: params.messages,
      stream: true,
    }),
  })
}

/** Forward to Anthropic with tool definitions (non-streaming for tool loop) */
async function forwardToAnthropicAgent(params: {
  apiKey: string; model?: string; messages: unknown[]; system?: string
  maxTokens?: number; tools?: unknown[]
}): Promise<Response> {
  return fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': params.apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: params.model || 'claude-3-5-haiku-20241022',
      max_tokens: params.maxTokens || 4096,
      system: params.system || undefined,
      messages: params.messages,
      tools: params.tools || undefined,
    }),
  })
}

async function streamResponseBody(source: ReadableStream<Uint8Array>, res: import('http').ServerResponse): Promise<void> {
  const reader = source.getReader()
  const decoder = new TextDecoder()
  let done = false
  while (!done) {
    const { value, done: streamDone } = await reader.read()
    done = streamDone
    if (value) res.write(decoder.decode(value, { stream: true }))
  }
  res.end()
}

/** Proxy endpoint for Anthropic API calls (avoids browser CORS issues) */
function aiChatProxyPlugin(): Plugin {
  return {
    name: 'ai-chat-proxy',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (req.url !== '/api/ai/chat' || req.method !== 'POST') return next()

        try {
          const body = await readRequestBody(req)
          const params = JSON.parse(body)
          if (!params.apiKey) {
            res.statusCode = 400
            res.end(JSON.stringify({ error: 'Missing API key' }))
            return
          }

          const anthropicRes = await forwardToAnthropic(params)
          if (!anthropicRes.ok) {
            res.statusCode = anthropicRes.status
            res.setHeader('Content-Type', 'application/json')
            res.end(await anthropicRes.text())
            return
          }

          res.setHeader('Content-Type', 'text/event-stream')
          res.setHeader('Cache-Control', 'no-cache')
          res.setHeader('Connection', 'keep-alive')

          if (anthropicRes.body) {
            await streamResponseBody(anthropicRes.body, res)
          } else {
            res.end()
          }
        } catch (err: unknown) {
          res.statusCode = 500
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ error: err instanceof Error ? err.message : 'Internal server error' }))
        }
      })
    },
  }
}

/** Agent proxy — non-streaming Anthropic calls with tool support */
function aiAgentProxyPlugin(): Plugin {
  return {
    name: 'ai-agent-proxy',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (req.url !== '/api/ai/agent' || req.method !== 'POST') return next()

        try {
          const body = await readRequestBody(req)
          const params = JSON.parse(body)
          if (!params.apiKey) {
            res.statusCode = 400
            res.end(JSON.stringify({ error: 'Missing API key' }))
            return
          }

          const anthropicRes = await forwardToAnthropicAgent(params)
          res.statusCode = anthropicRes.status
          res.setHeader('Content-Type', 'application/json')
          res.end(await anthropicRes.text())
        } catch (err: unknown) {
          res.statusCode = 500
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ error: err instanceof Error ? err.message : 'Internal server error' }))
        }
      })
    },
  }
}

/** WebSocket proxy info endpoint — tells the frontend where the MCP bridge is */
function mcpBridgeInfoPlugin(): Plugin {
  return {
    name: 'mcp-bridge-info',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (req.url !== '/api/mcp/info') return next()
        res.setHeader('Content-Type', 'application/json')
        res.end(JSON.stringify({
          wsUrl: `ws://localhost:${process.env.MCP_WS_PORT || 9710}`,
          available: true,
        }))
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), vaultApiPlugin(), aiChatProxyPlugin(), aiAgentProxyPlugin(), mcpBridgeInfoPlugin()],

  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },

  // Prevent vite from obscuring Rust errors
  clearScreen: false,

  // Tauri expects a fixed port
  server: {
    port: 5202,
    strictPort: true,
    allowedHosts: true,
  },

  // Env variables starting with TAURI_ are exposed to the frontend
  envPrefix: ['VITE_', 'TAURI_'],

  build: {
    // Tauri uses Chromium on Windows and WebKit on macOS/Linux
    target: process.env.TAURI_PLATFORM === 'windows' ? 'chrome105' : 'safari13',
    // Don't minify for debug builds
    minify: !process.env.TAURI_DEBUG ? 'esbuild' : false,
    // Produce sourcemaps for debug builds
    sourcemap: !!process.env.TAURI_DEBUG,
  },

  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'src/**/*.{test,spec}.{ts,tsx}',
        'src/test/**',
        'src/mock-tauri.ts',
        'src/main.tsx',
        'src/types.ts',
        'src/hooks/useMcpBridge.ts',
        'src/hooks/useAIChat.ts',
        'src/hooks/useAiAgent.ts',
        'src/utils/ai-chat.ts',
        'src/utils/ai-agent.ts',
        'src/components/AIChatPanel.tsx',
        'src/components/ui/dropdown-menu.tsx',
        'src/components/ui/scroll-area.tsx',
        'src/components/ui/select.tsx',
        'src/components/ui/separator.tsx',
        'src/components/ui/tabs.tsx',
        'src/components/ui/tooltip.tsx',
        'src/components/ui/card.tsx',
      ],
      thresholds: {
        lines: 70,
        functions: 70,
        branches: 70,
        statements: 70,
      },
    },
  },
})
