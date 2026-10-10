import { spawn } from 'node:child_process'
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import http from 'isomorphic-git/http/node'
import type { HttpClient } from 'isomorphic-git'

export function gitTestEnvironment() {
  return {
    ...Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith('GIT_'))),
    NODE_ENV: process.env.NODE_ENV,
    GIT_CONFIG_NOSYSTEM: '1',
    GIT_CONFIG_GLOBAL: '/dev/null',
  }
}

/** Real smart-HTTP Git transport against disposable repositories, never user data. */
export async function startGitTestServer(root: string) {
  const server = createServer((request, response) => serveGit(root, request, response))
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  const address = server.address()
  if (!address || typeof address === 'string') throw new Error('Missing test server address')
  const client: HttpClient = {
    request: (request) => {
      const url = new URL(request.url)
      url.host = `127.0.0.1:${address.port}`
      url.protocol = 'http:'
      return http.request({ ...request, url: url.toString() })
    },
  }
  return {
    http: client,
    close: () => new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve())),
  }
}

function serveGit(root: string, request: IncomingMessage, response: ServerResponse) {
  const url = new URL(request.url ?? '/', 'http://localhost')
  const child = spawn('git', ['http-backend'], {
    env: {
      ...gitTestEnvironment(),
      GIT_PROJECT_ROOT: root,
      GIT_HTTP_EXPORT_ALL: '1',
      PATH_INFO: url.pathname,
      QUERY_STRING: url.search.slice(1),
      REQUEST_METHOD: request.method,
      CONTENT_TYPE: request.headers['content-type'] ?? '',
      REMOTE_USER: 'test',
    },
  })
  request.pipe(child.stdin)
  const chunks: Buffer[] = []
  child.stdout.on('data', (chunk: Buffer) => chunks.push(chunk))
  child.on('close', () => sendGitResponse(Buffer.concat(chunks), response))
  child.on('error', () => { response.statusCode = 500; response.end() })
}

function sendGitResponse(output: Buffer, response: ServerResponse) {
  const boundary = output.indexOf('\r\n\r\n')
  if (boundary === -1) { response.statusCode = 500; response.end(); return }
  for (const header of output.subarray(0, boundary).toString().split('\r\n')) {
    const colon = header.indexOf(':')
    const key = header.slice(0, colon)
    const value = header.slice(colon + 1).trim()
    if (key === 'Status') response.statusCode = Number(value.split(' ')[0])
    else response.setHeader(key, value)
  }
  response.end(output.subarray(boundary + 4))
}
