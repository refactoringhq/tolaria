import { useState, useEffect, useCallback, useRef } from 'react'
import { isTauri, mockInvoke } from '../mock-tauri'

interface DeviceFlowResponse {
  device_code: string
  user_code: string
  verification_uri: string
  expires_in: number
  interval: number
}

export interface GithubUser {
  login: string
  name: string | null
  avatar_url: string
}

export type GithubAuthStatus =
  | { state: 'disconnected' }
  | { state: 'loading' }
  | { state: 'device_flow'; userCode: string; verificationUri: string }
  | { state: 'connected'; user: GithubUser }
  | { state: 'error'; message: string }

function tauriCall<T>(command: string, args?: Record<string, unknown>): Promise<T> {
  if (isTauri()) {
    return import('@tauri-apps/api/core').then(({ invoke }) => invoke<T>(command, args))
  }
  return mockInvoke<T>(command, args)
}

export function useGithubAuth() {
  const [status, setStatus] = useState<GithubAuthStatus>({ state: 'loading' })
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const deviceCodeRef = useRef<string | null>(null)

  const stopPolling = useCallback(() => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current)
      pollingRef.current = null
    }
    deviceCodeRef.current = null
  }, [])

  // On mount, check for existing token and fetch user info
  useEffect(() => {
    let cancelled = false
    async function init() {
      try {
        const token = await tauriCall<string | null>('github_get_stored_token')
        if (cancelled) return
        if (!token) {
          setStatus({ state: 'disconnected' })
          return
        }
        const user = await tauriCall<GithubUser>('github_get_user', { token })
        if (cancelled) return
        setStatus({ state: 'connected', user })
      } catch (err) {
        if (cancelled) return
        // Token might be revoked — treat as disconnected
        console.warn('[github-auth] Failed to load user:', err)
        setStatus({ state: 'disconnected' })
      }
    }
    init()
    return () => { cancelled = true }
  }, [])

  const connect = useCallback(async () => {
    stopPolling()
    setStatus({ state: 'loading' })
    try {
      const flow = await tauriCall<DeviceFlowResponse>('github_start_device_flow')
      deviceCodeRef.current = flow.device_code
      setStatus({
        state: 'device_flow',
        userCode: flow.user_code,
        verificationUri: flow.verification_uri,
      })

      // Start polling
      const interval = Math.max(flow.interval, 5) * 1000
      pollingRef.current = setInterval(async () => {
        if (!deviceCodeRef.current) return
        try {
          const token = await tauriCall<string | null>('github_poll_token', {
            deviceCode: deviceCodeRef.current,
          })
          if (token) {
            stopPolling()
            try {
              const user = await tauriCall<GithubUser>('github_get_user', { token })
              setStatus({ state: 'connected', user })
            } catch {
              // Token works but user fetch failed — still connected
              setStatus({ state: 'connected', user: { login: 'unknown', name: null, avatar_url: '' } })
            }
          }
          // If null, still pending — keep polling
        } catch (err) {
          stopPolling()
          setStatus({ state: 'error', message: String(err) })
        }
      }, interval)

      // Auto-expire after expires_in seconds
      setTimeout(() => {
        if (deviceCodeRef.current === flow.device_code) {
          stopPolling()
          setStatus({ state: 'error', message: 'Device code expired. Please try again.' })
        }
      }, flow.expires_in * 1000)
    } catch (err) {
      setStatus({ state: 'error', message: String(err) })
    }
  }, [stopPolling])

  const disconnect = useCallback(async () => {
    stopPolling()
    try {
      await tauriCall<void>('github_disconnect')
    } catch (err) {
      console.warn('[github-auth] Failed to disconnect:', err)
    }
    setStatus({ state: 'disconnected' })
  }, [stopPolling])

  const cancel = useCallback(() => {
    stopPolling()
    setStatus({ state: 'disconnected' })
  }, [stopPolling])

  // Cleanup on unmount
  useEffect(() => {
    return () => stopPolling()
  }, [stopPolling])

  return { status, connect, disconnect, cancel }
}
