import { isTauri } from '../mock-tauri'

type DiagnosticLevel = 'error' | 'warn'

interface DiagnosticEntry {
  level: DiagnosticLevel
  message: string
}

interface DiagnosticBundleContext {
  buildNumber?: string
  releaseChannel?: string | null
}

const MAX_DIAGNOSTICS = 8
const PATH_PATTERN = /(?:\/[\w.-]+){2,}|[A-Z]:\\(?:[\w .-]+\\)+[\w .-]+/g
const TOKEN_PATTERN = /\b(?:gh[oprsu]_[A-Za-z0-9_]+|github_pat_[A-Za-z0-9_]+|sk-[A-Za-z0-9_-]+|xox[baprs]-[A-Za-z0-9-]+)\b/g
const SENSITIVE_KEY_PATTERN = /(token|secret|password|authorization|cookie|session)/i

let recentDiagnostics: DiagnosticEntry[] = []
let stopCapture: (() => void) | null = null

function truncate(input: string, maxLength = 240): string {
  if (input.length <= maxLength) return input
  return `${input.slice(0, maxLength - 1)}…`
}

function sanitizeText(input: string): string {
  return truncate(
    input
      .replace(PATH_PATTERN, '<redacted-path>')
      .replace(TOKEN_PATTERN, '<redacted-token>')
      .replace(/\s+/g, ' ')
      .trim(),
  )
}

function safeSerialize(value: unknown): string {
  if (value instanceof Error) {
    return `${value.name}: ${value.message}`
  }

  if (typeof value === 'string') {
    return value
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value)
  }

  if (value == null) {
    return String(value)
  }

  try {
    return JSON.stringify(value, (key, nestedValue) => {
      if (typeof nestedValue === 'string') {
        return SENSITIVE_KEY_PATTERN.test(key) ? '<redacted-token>' : truncate(nestedValue, 120)
      }
      return nestedValue
    })
  } catch {
    return Object.prototype.toString.call(value)
  }
}

function recordDiagnostic(level: DiagnosticLevel, values: unknown[]): void {
  const message = sanitizeText(values.map((value) => safeSerialize(value)).join(' '))
  if (!message) return

  recentDiagnostics = [
    ...recentDiagnostics.slice(-(MAX_DIAGNOSTICS - 1)),
    { level, message },
  ]
}

function resolveRuntime(): string {
  if (typeof window === 'undefined') return 'unknown'
  return isTauri() ? 'tauri' : 'browser'
}

function resolvePlatform(): string {
  if (typeof navigator === 'undefined') return 'unknown'
  return sanitizeText(navigator.platform || 'unknown')
}

function resolveUserAgent(): string {
  if (typeof navigator === 'undefined') return 'unknown'
  return sanitizeText(navigator.userAgent || 'unknown')
}

export function startFeedbackDiagnosticsCapture(): () => void {
  if (stopCapture || typeof window === 'undefined') {
    return stopCapture ?? (() => {})
  }

  const originalError = console.error
  const originalWarn = console.warn

  console.error = (...args: Parameters<typeof console.error>) => {
    recordDiagnostic('error', args)
    originalError(...args)
  }

  console.warn = (...args: Parameters<typeof console.warn>) => {
    recordDiagnostic('warn', args)
    originalWarn(...args)
  }

  const handleError = (event: ErrorEvent) => {
    recordDiagnostic('error', [event.error ?? event.message ?? 'Unhandled window error'])
  }

  const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
    recordDiagnostic('error', ['Unhandled rejection:', event.reason])
  }

  window.addEventListener('error', handleError)
  window.addEventListener('unhandledrejection', handleUnhandledRejection)

  stopCapture = () => {
    console.error = originalError
    console.warn = originalWarn
    window.removeEventListener('error', handleError)
    window.removeEventListener('unhandledrejection', handleUnhandledRejection)
    stopCapture = null
  }

  return stopCapture
}

export function buildSanitizedDiagnosticBundle({
  buildNumber,
  releaseChannel,
}: DiagnosticBundleContext): string {
  const lines = [
    'Tolaria sanitized diagnostics',
    `Generated: ${new Date().toISOString()}`,
    `Build: ${buildNumber ?? 'unknown'}`,
    `Release channel: ${releaseChannel ?? 'stable'}`,
    `Runtime: ${resolveRuntime()}`,
    `Platform: ${resolvePlatform()}`,
    `User agent: ${resolveUserAgent()}`,
    '',
    'Recent diagnostics:',
  ]

  if (recentDiagnostics.length === 0) {
    lines.push('No safe recent diagnostics were available.')
  } else {
    for (const entry of recentDiagnostics) {
      lines.push(`- [${entry.level}] ${entry.message}`)
    }
  }

  lines.push('')
  lines.push('Notes: paths and token-like strings are redacted. This bundle is sanitized and optional.')

  return lines.join('\n')
}

export function __resetFeedbackDiagnosticsForTest(): void {
  stopCapture?.()
  recentDiagnostics = []
}
