import { randomUUID } from 'expo-crypto'
import { cacheDirectory, copyAsync, deleteAsync, makeDirectoryAsync, writeAsStringAsync } from 'expo-file-system/legacy'
import { useEffect, useMemo, useState } from 'react'
import { mobileAttachmentUriForHref, mobileHtmlWithResolvedAttachmentUris, mobilePortableAttachmentPath } from '../../workspace/mobileAttachmentUris'
import { mobileMarkdownBodyToTentapHtml } from '../../workspace/mobileDocumentContent'
import { mobileMarkdownHasDiagrams } from '../../workspace/mobileDiagramMarkdown'
import { mobileWysiwygTentapEditorHtml } from './MobileWysiwygTentapEditorHtml'
import { copyMobileDiagramRenderer } from './mobileDiagramRendererAsset.native'

type VaultRootUri = string
type MarkdownBody = string

let preparedShell: Promise<string> | null = null
let cacheInitialized = false
const previewCache = `${cacheDirectory}tolaria-editor-previews/`

export function mobileEditorPreviewHtml(markdown: MarkdownBody, vaultRootUri?: VaultRootUri | null): string {
  // Images stay portable in Tiptap JSON and resolve relative to the private shell.
  return mobileMarkdownBodyToTentapHtml(markdown, { diagrams: true }).replace(/\bhref=".*?"/gu,
    (link) => mobileHtmlWithResolvedAttachmentUris(link, vaultRootUri))
}

async function prepareEditorShell(): Promise<string> {
  preparedShell ??= writeEditorShell().catch((error: unknown) => {
    preparedShell = null
    throw error
  })
  return preparedShell
}

async function writeEditorShell(): Promise<string> {
  if (!cacheDirectory) throw new Error('Editor cache directory unavailable')
  if (!cacheInitialized) {
    await deleteAsync(previewCache, { idempotent: true })
    await makeDirectoryAsync(previewCache, { intermediates: true })
    cacheInitialized = true
  }
  const uri = `${previewCache}editor.html`
  const shell = mobileWysiwygTentapEditorHtml.replace(
    '</head>',
    '<style>#root { visibility: hidden; }</style></head>',
  )
  await writeAsStringAsync(uri, shell)
  return uri
}

class MobileEditorPreview {
  readonly rootUri = `${previewCache}${randomUUID()}/`
  readonly source = { uri: `${this.rootUri}editor.html` }
  private readonly copied = new Set<string>()
  private initialized = false
  private diagramsReady = false
  private disposed = false
  private pending: Promise<void> = Promise.resolve()

  constructor(private readonly vaultRootUri: VaultRootUri) {}

  private async preparePaths(paths: readonly string[], diagrams = false) {
    if (this.disposed) throw new Error('Editor preview disposed')
    this.pending = this.pending.catch(() => undefined).then(async () => {
      await this.initialize()
      await this.copyImages(paths)
      if (diagrams) await this.prepareDiagrams()
    })
    await this.pending
  }

  private async initialize() {
    if (this.initialized) return
    const template = await prepareEditorShell()
    await makeDirectoryAsync(this.rootUri, { intermediates: true })
    await copyAsync({ from: template, to: this.source.uri })
    this.initialized = true
  }

  private async copyImages(paths: readonly string[]) {
    for (const path of paths) {
      if (this.copied.has(path)) continue
      if (await this.copyImage(path)) this.copied.add(path)
    }
  }

  private async copyImage(path: string): Promise<boolean> {
    const from = mobileAttachmentUriForHref(path, this.vaultRootUri)
    const to = mobileAttachmentUriForHref(path, this.rootUri)
    if (!from || !to) return false
    try {
      await makeDirectoryAsync(to.slice(0, to.lastIndexOf('/')), { intermediates: true })
      await copyAsync({ from, to })
      return true
    } catch {
      // A missing attachment must not prevent the note itself from opening.
      return false
    }
  }

  private async prepareDiagrams() {
    if (this.diagramsReady) return
    try { await copyMobileDiagramRenderer(this.rootUri); this.diagramsReady = true }
    catch { /* An optional preview failure must retain the editable source. */ }
  }

  prepare(markdown: MarkdownBody) { return this.preparePaths(previewImagePaths(markdown), mobileMarkdownHasDiagrams(markdown, 'mermaid')) }
  prepareAttachment = (href: string) => this.preparePaths(mobilePortableAttachmentPath(href) ? [href] : [])

  async dispose() {
    this.disposed = true
    await this.pending.catch(() => undefined)
    await deleteAsync(this.rootUri, { idempotent: true })
  }
}

export function createMobileEditorPreview(vaultRootUri: VaultRootUri) {
  return new MobileEditorPreview(vaultRootUri)
}

function previewImagePaths(markdown: MarkdownBody): string[] {
  const html = mobileMarkdownBodyToTentapHtml(markdown)
  return [...new Set([...html.matchAll(/\bsrc="(.*?)"/gu)]
    .map((match) => mobilePortableAttachmentPath(match[1] ?? ''))
    .filter((path): path is string => path !== null))]
}

export function mobileEditorFileWebViewProps(preview: ReturnType<typeof createMobileEditorPreview>) {
  return {
    source: preview.source,
    allowingReadAccessToURL: preview.rootUri,
    allowFileAccess: true,
    allowUniversalAccessFromFileURLs: false,
    // Inspect every navigation rather than letting WebView launch external URLs.
    originWhitelist: ['*'],
    onShouldStartLoadWithRequest: ({ url, isTopFrame }: { url: string; isTopFrame?: boolean }) =>
      url === preview.source.uri || url === 'about:blank'
      || (isTopFrame === false && url === `${preview.rootUri}diagram-renderer.html`),
  }
}

export function useMobileEditorFileSource(vaultRootUri: VaultRootUri | null | undefined, markdown: MarkdownBody) {
  const preview = useMemo(() => vaultRootUri ? createMobileEditorPreview(vaultRootUri) : null, [vaultRootUri])
  const [prepared, setPrepared] = useState<typeof preview>(null)
  const [failed, setFailed] = useState<typeof preview>(null)
  useEffect(() => () => { void preview?.dispose().catch(() => undefined) }, [preview])
  useEffect(() => preparePreview(preview, markdown, { prepared: setPrepared, failed: setFailed }, failed), [preview, markdown, failed])
  const webViewProps: Partial<ReturnType<typeof mobileEditorFileWebViewProps>> =
    preview && prepared === preview ? mobileEditorFileWebViewProps(preview) : {}
  return {
    ready: prepared === preview || failed === preview,
    webViewProps,
    prepareAttachment: preview?.prepareAttachment,
  }
}

function preparePreview(
  preview: MobileEditorPreview | null, markdown: MarkdownBody,
  callbacks: { prepared: (preview: MobileEditorPreview) => void; failed: (preview: MobileEditorPreview) => void },
  failedPreview: MobileEditorPreview | null,
) {
  // Never replace an inline fallback's source while the user is typing in it.
  if (!preview || preview === failedPreview) return
  let disposed = false
  void preview.prepare(markdown).then(
    () => { if (!disposed) callbacks.prepared(preview) },
    () => { if (!disposed) callbacks.failed(preview) },
  )
  return () => { disposed = true }
}
