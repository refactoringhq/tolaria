import { useEffect, useState, useSyncExternalStore } from 'react'
import { beginGitHubSignIn, finishGitHubSignIn, listGitHubRepositories, refreshGitHubSession } from './githubAuth'
import { clearGitHubSession, readGitHubSession, saveGitHubSession } from './githubSessionStore'
import { createGitHubAccountState } from './githubAccountState'

const clientId = process.env.EXPO_PUBLIC_GITHUB_CLIENT_ID ?? ''

export function useGitHubAccount() {
  const [account] = useState(() => createGitHubAccountState({
    restore: readGitHubSession, save: saveGitHubSession, clear: clearGitHubSession,
    begin: () => beginGitHubSignIn(clientId),
    finish: (code, signal) => finishGitHubSignIn(clientId, code, signal),
    refresh: (session) => refreshGitHubSession(session, clientId),
    list: listGitHubRepositories,
  }))
  const state = useSyncExternalStore(account.subscribe, account.snapshot, account.snapshot)
  useEffect(() => { void account.restore(); return account.cancelSignIn }, [account])
  return {
    ...state, configured: Boolean(clientId.trim()),
    currentSession: account.currentSession, signIn: account.signIn, signOut: account.signOut,
    cancelSignIn: account.cancelSignIn, loadRepositories: account.loadRepositories,
  }
}
