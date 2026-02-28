import { useState, useRef, useCallback, useEffect } from 'react'
import { GithubLogo, CircleNotch, ArrowClockwise, Copy, Check } from '@phosphor-icons/react'
import { invoke } from '@tauri-apps/api/core'
import { isTauri, mockInvoke } from '../mock-tauri'
import { openExternalUrl } from '../utils/url'
import type { DeviceFlowStart, DeviceFlowPollResult, GitHubUser } from '../types'

function tauriCall<T>(cmd: string, args: Record<string, unknown> = {}): Promise<T> {
  return isTauri() ? invoke<T>(cmd, args) : mockInvoke<T>(cmd, args)
}

type OAuthStatus = 'idle' | 'waiting' | 'error'

/** Process a device flow poll result. Returns 'done' if auth complete, 'continue' to keep polling. */
function processPollResult(
  result: DeviceFlowPollResult,
  callbacks: {
    onComplete: (token: string) => Promise<void>
    onExpired: () => void
    onError: (msg: string) => void
  },
): 'done' | 'continue' {
  if (result.status === 'complete' && result.access_token) {
    callbacks.onComplete(result.access_token)
    return 'done'
  }
  if (result.status === 'expired') {
    callbacks.onExpired()
    return 'done'
  }
  if (result.status === 'error') {
    callbacks.onError(result.error ?? 'Authorization failed.')
    return 'done'
  }
  return 'continue'
}

interface GitHubDeviceFlowProps {
  onConnected: (token: string, username: string) => void
}

export function GitHubDeviceFlow({ onConnected }: GitHubDeviceFlowProps) {
  const [oauthStatus, setOauthStatus] = useState<OAuthStatus>('idle')
  const [userCode, setUserCode] = useState<string | null>(null)
  const [verificationUri, setVerificationUri] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const pollingRef = useRef(false)
  const deviceCodeRef = useRef<string | null>(null)

  const stopPolling = useCallback(() => {
    pollingRef.current = false
    deviceCodeRef.current = null
  }, [])

  useEffect(() => {
    return () => { pollingRef.current = false }
  }, [])

  const handleLogin = useCallback(async () => {
    setOauthStatus('waiting')
    setErrorMessage(null)
    setUserCode(null)

    try {
      const flowStart = await tauriCall<DeviceFlowStart>('github_device_flow_start')
      setUserCode(flowStart.user_code)
      setVerificationUri(flowStart.verification_uri)
      deviceCodeRef.current = flowStart.device_code
      openExternalUrl(flowStart.verification_uri).catch(() => {})

      pollingRef.current = true
      const intervalMs = Math.max(flowStart.interval * 1000, 5000)

      const pollLoop = async () => {
        while (pollingRef.current && deviceCodeRef.current) {
          await new Promise(r => setTimeout(r, intervalMs))
          if (!pollingRef.current) break

          const result = await tauriCall<DeviceFlowPollResult>('github_device_flow_poll', {
            deviceCode: deviceCodeRef.current,
          })
          const outcome = processPollResult(result, {
            onComplete: async (token) => {
              const user = await tauriCall<GitHubUser>('github_get_user', { token })
              stopPolling()
              setOauthStatus('idle')
              setUserCode(null)
              onConnected(token, user.login)
            },
            onExpired: () => {
              stopPolling()
              setOauthStatus('error')
              setErrorMessage('Authorization expired. Please try again.')
            },
            onError: (msg) => {
              stopPolling()
              setOauthStatus('error')
              setErrorMessage(msg)
            },
          })
          if (outcome === 'done') return
        }
      }

      pollLoop().catch(err => {
        stopPolling()
        setOauthStatus('error')
        setErrorMessage(typeof err === 'string' ? err : err instanceof Error ? err.message : 'Polling failed.')
      })
    } catch (err) {
      setOauthStatus('error')
      setErrorMessage(typeof err === 'string' ? err : err instanceof Error ? err.message : 'Failed to start login.')
    }
  }, [onConnected, stopPolling])

  const resetOAuth = useCallback(() => {
    stopPolling()
    setOauthStatus('idle')
    setUserCode(null)
    setVerificationUri(null)
    setErrorMessage(null)
  }, [stopPolling])

  if (oauthStatus === 'waiting' && userCode) {
    return <DeviceCodeView userCode={userCode} verificationUri={verificationUri} onCancel={resetOAuth} />
  }

  return <LoginButton onLogin={handleLogin} disabled={oauthStatus === 'waiting'} errorMessage={errorMessage} onRetry={errorMessage ? () => { resetOAuth(); handleLogin() } : undefined} />
}

function DeviceCodeView({ userCode, verificationUri, onCancel }: { userCode: string; verificationUri: string | null; onCancel: () => void }) {
  const [copied, setCopied] = useState(false)

  const handleCopyCode = useCallback(() => {
    navigator.clipboard.writeText(userCode).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }).catch(() => {})
  }, [userCode])

  const handleOpenUrl = useCallback(() => {
    if (verificationUri) openExternalUrl(verificationUri).catch(() => {})
  }, [verificationUri])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }} data-testid="github-waiting">
      <div
        className="border border-border rounded px-4 py-3"
        style={{ display: 'flex', flexDirection: 'column', gap: 8, textAlign: 'center' }}
      >
        <div style={{ fontSize: 12, color: 'var(--muted-foreground)' }}>Enter this code on GitHub:</div>
        <div className="flex items-center justify-center gap-2">
          <div
            style={{ fontSize: 24, fontWeight: 700, letterSpacing: 4, color: 'var(--foreground)', fontFamily: 'monospace' }}
            data-testid="github-user-code"
          >
            {userCode}
          </div>
          <button
            className="border-none bg-transparent p-1 text-muted-foreground cursor-pointer hover:text-foreground"
            onClick={handleCopyCode}
            title="Copy code"
            data-testid="github-copy-code"
          >
            {copied ? <Check size={16} /> : <Copy size={16} />}
          </button>
        </div>
        {verificationUri && (
          <button
            className="border-none bg-transparent text-muted-foreground cursor-pointer hover:text-foreground underline"
            style={{ fontSize: 12 }}
            onClick={handleOpenUrl}
            data-testid="github-open-url"
          >
            {verificationUri}
          </button>
        )}
        <div className="flex items-center justify-center gap-2" style={{ fontSize: 12, color: 'var(--muted-foreground)' }}>
          <CircleNotch size={14} className="animate-spin" />
          Waiting for authorization...
        </div>
      </div>
      <button
        className="border border-border bg-transparent text-muted-foreground rounded cursor-pointer hover:text-foreground"
        style={{ fontSize: 12, padding: '6px 12px', alignSelf: 'center' }}
        onClick={onCancel}
        data-testid="github-cancel"
      >
        Cancel
      </button>
    </div>
  )
}

function LoginButton({ onLogin, disabled, errorMessage, onRetry }: { onLogin: () => void; disabled: boolean; errorMessage: string | null; onRetry?: () => void }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <button
        className="border-none rounded cursor-pointer flex items-center justify-center gap-2"
        style={{ fontSize: 13, fontWeight: 500, padding: '8px 16px', background: 'var(--foreground)', color: 'var(--background)', height: 36 }}
        onClick={onLogin}
        disabled={disabled}
        data-testid="github-login"
      >
        <GithubLogo size={16} weight="fill" />
        Login with GitHub
      </button>
      {errorMessage && (
        <div className="flex items-center gap-2" style={{ fontSize: 12, color: 'var(--destructive, #e03e3e)' }}>
          <span data-testid="github-error">{errorMessage}</span>
          {onRetry && (
            <button
              className="border-none bg-transparent cursor-pointer hover:text-foreground flex items-center gap-1"
              style={{ fontSize: 12, color: 'var(--destructive, #e03e3e)', padding: 0 }}
              onClick={onRetry}
              data-testid="github-retry"
            >
              <ArrowClockwise size={12} />
              Retry
            </button>
          )}
        </div>
      )}
    </div>
  )
}
