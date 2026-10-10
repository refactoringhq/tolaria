import { fetch } from 'expo/fetch'
import { createGitFetchClient } from './gitFetchClient'

export const nativeGitHttp = createGitFetchClient(fetch)
