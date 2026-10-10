export const gitVirtualRoot = '/vault'

export function gitFileUri(rootUri: string, path: string): string {
  if (!rootUri.startsWith('file:///')) throw new Error('unsupportedGitStorage')
  if (!isInsideGitVault(path)) throw new Error('outsideGitVault')
  const segments = path.slice(gitVirtualRoot.length).split('/').filter(Boolean)
  if (!segments.every(isSafeSegment)) throw new Error('outsideGitVault')
  return `${rootUri.replace(/\/$/u, '')}/${segments.map(encodeURIComponent).join('/')}`
}

function isInsideGitVault(path: string): boolean {
  return path === gitVirtualRoot || path.startsWith(`${gitVirtualRoot}/`)
}

function isSafeSegment(segment: string): boolean {
  const forbidden = ['.', '..']
  return !forbidden.includes(segment) && !segment.includes('\\') && !segment.includes('\0')
}

export function gitFsError(code: string): Error & { code: string } {
  return Object.assign(new Error(code), { code })
}
