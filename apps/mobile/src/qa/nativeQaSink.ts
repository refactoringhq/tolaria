let endpoint: string | null = null

export function setNativeQaSinkUrl(value: string | null) {
  endpoint = localCollectorUrl(value)
}

function localCollectorUrl(value: string | null): string | null {
  if (!value) return null
  try {
    const url = new URL(value)
    if (url.protocol !== 'http:' || url.hostname !== '127.0.0.1') return null
    if (url.username || url.password || url.hash) return null
    return value
  } catch { return null }
}

export function postNativeQaEvent(event: unknown) {
  if (!endpoint) return
  void fetch(endpoint, {
    body: JSON.stringify(event),
    headers: { 'content-type': 'application/json' },
    method: 'POST',
    redirect: 'error',
    credentials: 'omit',
  }).catch(() => undefined)
}

export function logNativeQaProof(line: string) {
  console.info(line)
  postNativeQaEvent({ proofLog: line })
}

const proofPrefixes = [
  'TOLARIA_MOBILE_WYSIWYG_MUTATION_PROBE ',
  'TOLARIA_MOBILE_WYSIWYG_PERSISTENCE_PROBE ',
]

export function nativeQaSinkLogLine(event: unknown): string | null {
  if (!event || typeof event !== 'object') return null
  if ('proofLog' in event) return acceptedProofLine(event.proofLog)
  if (!validMetric(event)) return null
  return `TOLARIA_MOBILE_LAYOUT_METRIC ${JSON.stringify(event)}`
}

function acceptedProofLine(line: unknown): string | null {
  if (typeof line !== 'string' || line.includes('\n') || line.length > 64_000) return null
  return proofPrefixes.some((prefix) => line.startsWith(prefix)) ? line : null
}

function validMetric(event: object): boolean {
  const metric = event as Record<string, unknown>
  return typeof metric.id === 'string' && typeof metric.platform === 'string'
    && ['x', 'y', 'width', 'height'].every((key) => typeof metric[key] === 'number' && Number.isFinite(metric[key]))
}
