export function insertWikilinkAtCursor(
  text: string,
  cursor: number,
  target: string,
): { text: string; cursor: number } {
  const before = text.slice(0, cursor)
  const after = text.slice(cursor)

  return {
    text: `${before}[[${target}]]${after}`,
    cursor: cursor + target.length + 4,
  }
}
