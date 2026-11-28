const LINK_PASTE_PROTOCOLS = new Set(['http:', 'https:'])

export type PastedUrlText = {
  text: string
}

/** Returns the URL when the text is exactly one bare http(s) URL, otherwise null. */
export function bareHttpUrl({ text }: PastedUrlText): string | null {
  if (!text || text !== text.trim()) return null

  try {
    return LINK_PASTE_PROTOCOLS.has(new URL(text).protocol) ? text : null
  } catch {
    return null
  }
}

/** Inline content that renders a pasted bare URL as a link right away. */
export function pastedUrlLinkContent(url: string): unknown[] {
  return [{ type: 'link', href: url, content: url }]
}
