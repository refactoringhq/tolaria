export type GitHubRequest = typeof fetch

export async function githubApi<T>(path: string, token: string, request: GitHubRequest): Promise<T> {
  const response = await boundedRequest(request, `https://api.github.com/${path}`, {
    headers: { Accept: 'application/vnd.github+json', Authorization: `Bearer ${token}` },
  })
  if (!response.ok) throw new Error(response.status === 401 ? 'githubAuthorizationExpired' : 'githubRequestFailed')
  return response.json()
}

export async function githubForm<T>(path: string, fields: Record<string, string>, request: GitHubRequest, signal?: AbortSignal): Promise<T> {
  const response = await boundedRequest(request, `https://github.com/login/${path}`, {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(fields).toString(),
    signal,
  })
  if (!response.ok) throw new Error('githubRequestFailed')
  return response.json()
}

async function boundedRequest(request: GitHubRequest, url: string, options: RequestInit) {
  const controller = new AbortController()
  const abort = () => controller.abort()
  const timeout = setTimeout(abort, 30_000)
  options.signal?.addEventListener('abort', abort, { once: true })
  if (options.signal?.aborted) abort()
  try {
    return await request(url, { ...options, signal: controller.signal, redirect: 'error' })
  } finally {
    clearTimeout(timeout)
    options.signal?.removeEventListener('abort', abort)
  }
}
