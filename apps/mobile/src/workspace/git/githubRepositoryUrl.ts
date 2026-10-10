export function githubRepositoryUrl(value: string): string {
  const url = new URL(value.trim())
  if (!isGitHubOrigin(url) || hasPrivateUrlFields(url)) throw new Error('invalidRepository')
  const repository = repositoryPath(url.pathname)
  return `https://github.com/${repository}.git`
}

function repositoryPath(path: string): string {
  const match = /^\/([a-zA-Z0-9_.-]+)\/([a-zA-Z0-9_.-]+)\/?$/u.exec(path)
  if (!match) throw new Error('invalidRepository')
  const name = match[2].replace(/\.git$/u, '')
  if (!name) throw new Error('invalidRepository')
  return `${match[1]}/${name}`
}

function isGitHubOrigin(url: URL) {
  return url.protocol === 'https:' && url.hostname === 'github.com' && !url.port
}

function hasPrivateUrlFields(url: URL) {
  return Boolean(url.username || url.password || url.search || url.hash)
}
