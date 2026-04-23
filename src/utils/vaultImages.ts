import { convertFileSrc } from '@tauri-apps/api/core'
import { isTauri } from '../mock-tauri'

const ASSET_URL_PREFIX = 'asset://localhost/'
const HTTP_ASSET_URL_PREFIX = 'http://asset.localhost/'
const ASSET_URL_PREFIXES = [ASSET_URL_PREFIX, HTTP_ASSET_URL_PREFIX]
const ATTACHMENTS_SEGMENT = '/attachments/'
const RELATIVE_ATTACHMENTS_PREFIX = 'attachments/'

type Markdown = string
type VaultPath = string
type AttachmentPath = string
type AbsolutePath = string
type MarkdownImageUrl = string

// Matches markdown image syntax: ![alt](url) or ![alt](url "title").
const MD_IMAGE_PATTERN = /!\[([^\]]*)\]\(([^)\s"]+)(\s+"[^"]*")?\)/g

function assetUrl(path: AbsolutePath): MarkdownImageUrl {
  return normalizeWebviewAssetUrl(convertFileSrc(path), path)
}

function vaultAttachmentPath(vaultPath: VaultPath, attachmentPath: AttachmentPath): AbsolutePath {
  return `${vaultPath}/${attachmentPath}`
}

function extractAttachmentPath(absolutePath: AbsolutePath): AttachmentPath | null {
  const index = absolutePath.lastIndexOf(ATTACHMENTS_SEGMENT)
  if (index === -1) return null

  const filename = absolutePath.slice(index + ATTACHMENTS_SEGMENT.length)
  return filename ? `${RELATIVE_ATTACHMENTS_PREFIX}${filename}` : null
}

function normalizeWebviewAssetUrl(url: MarkdownImageUrl, path: AbsolutePath): MarkdownImageUrl {
  if (url.startsWith(ASSET_URL_PREFIX)) {
    return `${HTTP_ASSET_URL_PREFIX}${encodeURIComponent(path)}`
  }
  return url
}

function assetUrlPrefix(url: MarkdownImageUrl): string | null {
  return ASSET_URL_PREFIXES.find(prefix => url.startsWith(prefix)) ?? null
}

function decodeAssetPath(url: MarkdownImageUrl): AbsolutePath {
  const prefix = assetUrlPrefix(url)
  return prefix ? decodeURIComponent(url.slice(prefix.length)) : ''
}

function isAssetUrl(url: MarkdownImageUrl): boolean {
  return assetUrlPrefix(url) !== null
}

function isCurrentVaultAsset(url: MarkdownImageUrl, vaultPath: VaultPath): boolean {
  const absolutePath = decodeAssetPath(url)
  return absolutePath === vaultPath || absolutePath.startsWith(`${vaultPath}/`)
}

function rewriteMarkdownImages(
  markdown: Markdown,
  transformUrl: (url: MarkdownImageUrl) => MarkdownImageUrl | null,
): Markdown {
  return markdown.replace(MD_IMAGE_PATTERN, (match, alt, url, title = '') => {
    const nextUrl = transformUrl(url)
    return nextUrl ? `![${alt}](${nextUrl}${title})` : match
  })
}

export function resolveImageUrls(markdown: Markdown, vaultPath: VaultPath): Markdown {
  if (!isTauri() || !vaultPath) return markdown

  return rewriteMarkdownImages(markdown, (url) => {
    if (url.startsWith(RELATIVE_ATTACHMENTS_PREFIX)) {
      return assetUrl(vaultAttachmentPath(vaultPath, url))
    }

    if (!isAssetUrl(url) || isCurrentVaultAsset(url, vaultPath)) {
      return null
    }

    const attachmentPath = extractAttachmentPath(decodeAssetPath(url))
    return attachmentPath ? assetUrl(vaultAttachmentPath(vaultPath, attachmentPath)) : null
  })
}

export function portableImageUrls(markdown: Markdown, vaultPath: VaultPath): Markdown {
  if (!vaultPath) return markdown

  const attachmentsPrefix = `${vaultPath}/${RELATIVE_ATTACHMENTS_PREFIX}`

  return rewriteMarkdownImages(markdown, (url) => {
    if (!isAssetUrl(url)) return null

    const absolutePath = decodeAssetPath(url)
    if (!absolutePath.startsWith(attachmentsPrefix)) return null

    return `${RELATIVE_ATTACHMENTS_PREFIX}${absolutePath.slice(attachmentsPrefix.length)}`
  })
}
