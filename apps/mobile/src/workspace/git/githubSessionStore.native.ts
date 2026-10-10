import * as SecureStore from 'expo-secure-store'
import type { GitHubSession } from './githubAuth'
import { parseGitHubSession } from './githubSession'

const key = 'tolaria.github.session.v1'

export async function readGitHubSession() {
  return parseGitHubSession(await SecureStore.getItemAsync(key))
}

export async function saveGitHubSession(session: GitHubSession) {
  const serialized = JSON.stringify(session)
  parseGitHubSession(serialized)
  await SecureStore.setItemAsync(key, serialized, { keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY })
}

export async function clearGitHubSession() {
  await SecureStore.deleteItemAsync(key)
}
