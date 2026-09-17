import DOMPurify from 'dompurify'
import { normalizeNotePathSeparators } from './notePathIdentity'
import { appendStaticPreviewCss } from './staticPreviewCss'
import { isPathInsideVaultRoot } from './vaultPathContainment'

type ConvertFileSrc = (path: string) => string

interface HtmlFilePreviewOptions {
  content: string
  convertFileSrc: ConvertFileSrc
  filePath: string
  vaultPath: string
}

interface TextValue {
  value: string
}

interface ResourceReference {
  reference: string
}

interface VaultResourceLocation extends ResourceReference {
  filePath: string
  vaultPath: string
}

interface ResourceRewrite extends ResourceReference {
  options: Pick<HtmlFilePreviewOptions, 'convertFileSrc' | 'filePath' | 'vaultPath'>
}

interface TextResourceRewrite extends TextValue {
  options: Pick<HtmlFilePreviewOptions, 'convertFileSrc' | 'filePath' | 'vaultPath'>
}

const PREVIEW_CSP = [
  "default-src 'none'",
  "script-src 'none'",
  "connect-src 'none'",
  "worker-src 'none'",
  "frame-src 'none'",
  "object-src 'none'",
  "form-action 'none'",
  "base-uri 'none'",
  'img-src asset: http://asset.localhost data: blob:',
  'media-src asset: http://asset.localhost data: blob:',
  'font-src asset: http://asset.localhost data:',
  "style-src 'unsafe-inline' asset: http://asset.localhost",
].join('; ')

const SANITIZE_CONFIG = {
  ADD_TAGS: ['link'],
  FORBID_TAGS: ['base', 'embed', 'form', 'frame', 'iframe', 'input', 'meta', 'object', 'script', 'select', 'textarea'],
  USE_PROFILES: { html: true, svg: true, svgFilters: true },
  WHOLE_DOCUMENT: true,
}

const URL_ATTRIBUTES = ['poster', 'src', 'xlink:href'] as const
const REMOTE_OR_PRIVILEGED_URL = /^(?:[a-z][a-z+.-]*:|\/\/)/iu
const DATA_OR_BLOB_URL = /^(?:data|blob):/iu
const CSS_URL = /url\(\s*(['"]?)([^'")]+)\1\s*\)/giu
const CSS_STRING_IMPORT = /@import\s+(['"])([^'"]+)\1/giu

function collapsePathSegments({ value }: TextValue): string {
  const normalized = normalizeNotePathSeparators(value)
  const drive = normalized.match(/^[a-z]:/iu)?.[0] ?? ''
  const absolute = normalized.startsWith('/')
  const segments = normalized.slice(drive.length).split('/').filter(Boolean)
  const collapsed: string[] = []

  for (const segment of segments) {
    if (segment === '.') continue
    if (segment === '..') {
      collapsed.pop()
      continue
    }
    collapsed.push(segment)
  }

  const prefix = drive ? `${drive}/` : absolute ? '/' : ''
  return `${prefix}${collapsed.join('/')}`
}

function parentDirectory({ value }: TextValue): string {
  const normalized = normalizeNotePathSeparators(value)
  const separatorIndex = normalized.lastIndexOf('/')
  return separatorIndex < 0 ? '' : normalized.slice(0, separatorIndex)
}

function splitResourceReference({ reference }: ResourceReference): { path: string; suffix: string } {
  const suffixIndex = reference.search(/[?#]/u)
  if (suffixIndex < 0) return { path: reference, suffix: '' }
  return { path: reference.slice(0, suffixIndex), suffix: reference.slice(suffixIndex) }
}

function decodedResourcePath({ value }: TextValue): string {
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}

function safeResourceSuffix({ value }: TextValue): string {
  return value.replace(/[\s"'()\\]/gu, character => encodeURIComponent(character))
}

function resolvedVaultResourcePath({ reference, filePath, vaultPath }: VaultResourceLocation): string | null {
  const { path } = splitResourceReference({ reference })
  const decodedPath = decodedResourcePath({ value: path })
  const root = normalizeNotePathSeparators(vaultPath).replace(/\/+$/u, '')
  const base = decodedPath.startsWith('/') ? root : parentDirectory({ value: filePath })
  const relative = decodedPath.replace(/^\/+/, '')
  const resolved = collapsePathSegments({ value: `${base}/${relative}` })
  return isPathInsideVaultRoot(resolved, vaultPath) ? resolved : null
}

function localAssetUrl({ reference, options }: ResourceRewrite): string | null {
  const trimmed = reference.trim()
  if (!trimmed) return null
  if (DATA_OR_BLOB_URL.test(trimmed)) return trimmed
  if (REMOTE_OR_PRIVILEGED_URL.test(trimmed)) return null

  const resolved = resolvedVaultResourcePath({
    reference: trimmed,
    filePath: options.filePath,
    vaultPath: options.vaultPath,
  })
  if (!resolved) return null
  const { suffix } = splitResourceReference({ reference: trimmed })
  return `${options.convertFileSrc(resolved)}${safeResourceSuffix({ value: suffix })}`
}

function rewriteCssResources({ value, options }: TextResourceRewrite): string {
  const rewriteReference = (reference: string) => localAssetUrl({ reference, options }) ?? 'data:,'
  return value
    .replace(CSS_URL, (_match, _quote: string, reference: string) => `url("${rewriteReference(reference)}")`)
    .replace(CSS_STRING_IMPORT, (_match, _quote: string, reference: string) => `@import url("${rewriteReference(reference)}")`)
}

function rewriteSrcset({ value, options }: TextResourceRewrite): string {
  return value
    .split(',')
    .map((candidate) => {
      const [reference, ...descriptor] = candidate.trim().split(/\s+/u)
      const assetUrl = reference ? localAssetUrl({ reference, options }) : null
      return assetUrl ? [assetUrl, ...descriptor].join(' ') : ''
    })
    .filter(Boolean)
    .join(', ')
}

function rewriteAnchor(anchor: HTMLAnchorElement, options: HtmlFilePreviewOptions) {
  const href = anchor.getAttribute('href')?.trim()
  if (!href || href.startsWith('#')) return

  if (!REMOTE_OR_PRIVILEGED_URL.test(href)) {
    const assetUrl = localAssetUrl({ reference: href, options })
    if (assetUrl) anchor.setAttribute('href', assetUrl)
    else anchor.removeAttribute('href')
  }
  anchor.setAttribute('target', '_blank')
  anchor.setAttribute('rel', 'noreferrer noopener')
}

function rewriteStylesheetLink(link: HTMLLinkElement, options: HtmlFilePreviewOptions) {
  const rel = link.rel.toLowerCase().split(/\s+/u)
  const href = link.getAttribute('href') ?? ''
  const assetUrl = rel.includes('stylesheet') ? localAssetUrl({ reference: href, options }) : null
  if (!assetUrl) {
    link.remove()
    return
  }
  link.setAttribute('href', assetUrl)
}

function rewriteElementResources(element: Element, options: HtmlFilePreviewOptions) {
  for (const attribute of URL_ATTRIBUTES) {
    const reference = element.getAttribute(attribute)
    if (reference === null) continue
    const assetUrl = localAssetUrl({ reference, options })
    if (assetUrl) element.setAttribute(attribute, assetUrl)
    else element.removeAttribute(attribute)
  }

  const srcset = element.getAttribute('srcset')
  if (srcset !== null) {
    const rewritten = rewriteSrcset({ value: srcset, options })
    if (rewritten) element.setAttribute('srcset', rewritten)
    else element.removeAttribute('srcset')
  }

  const inlineStyle = element.getAttribute('style')
  if (inlineStyle !== null) element.setAttribute('style', rewriteCssResources({ value: inlineStyle, options }))
}

function applyPreviewResourcePolicy(documentObject: Document, options: HtmlFilePreviewOptions) {
  documentObject.querySelectorAll('*').forEach((element) => {
    rewriteElementResources(element, options)
  })
  documentObject.querySelectorAll('style').forEach((style) => {
    style.textContent = rewriteCssResources({ value: style.textContent ?? '', options })
  })
  documentObject.querySelectorAll('link').forEach((link) => {
    rewriteStylesheetLink(link, options)
  })
  documentObject.querySelectorAll('a').forEach((anchor) => {
    rewriteAnchor(anchor, options)
  })
}

function installPreviewMetadata(documentObject: Document) {
  const charset = documentObject.createElement('meta')
  charset.setAttribute('charset', 'utf-8')
  const csp = documentObject.createElement('meta')
  csp.setAttribute('http-equiv', 'Content-Security-Policy')
  csp.setAttribute('content', PREVIEW_CSP)
  documentObject.head.prepend(charset, csp)
}

export function htmlFilePreviewSrcDoc(options: HtmlFilePreviewOptions): string {
  const sanitized = DOMPurify.sanitize(options.content, SANITIZE_CONFIG)
  const documentObject = new DOMParser().parseFromString(sanitized, 'text/html')
  applyPreviewResourcePolicy(documentObject, options)
  installPreviewMetadata(documentObject)
  appendStaticPreviewCss(documentObject)
  return `<!doctype html>${documentObject.documentElement.outerHTML}`
}
