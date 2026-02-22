import type { Plugin } from 'vite'
import type { IncomingMessage, ServerResponse } from 'http'

function readRequestBody(req: IncomingMessage): Promise<string> {
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

async function streamResponseBody(source: ReadableStream<Uint8Array>, res: ServerResponse): Promise<void> {
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
export function aiChatProxyPlugin(): Plugin {
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
