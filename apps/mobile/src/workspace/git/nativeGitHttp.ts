import { createGitFetchClient } from './gitFetchClient'

export const nativeGitHttp = createGitFetchClient(fetch)
