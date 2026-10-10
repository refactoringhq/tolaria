import type { GitHubSession } from './githubAuth'

export async function readGitHubSession(): Promise<GitHubSession | null> { return null }
export async function saveGitHubSession(session: GitHubSession) { void session; throw new Error('nativeOnly') }
export async function clearGitHubSession() {}
