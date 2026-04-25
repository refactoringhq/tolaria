// Shared title-to-stem slugging keeps frontend rename and wikilink behavior
// aligned with the backend rename pipeline.
export function slugifyNoteStem(text: string): string {
  const result = text
    .normalize('NFKC')
    .toLocaleLowerCase()
    .trim()
    .replace(/[^\p{Letter}\p{Number}]+/gu, '-')
    .replace(/(^-|-$)/g, '')
  return result || 'untitled'
}
