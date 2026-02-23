import { useState, useRef, useCallback, useEffect } from 'react'
import { X, Eye, EyeSlash, GithubLogo, SignOut, CircleNotch } from '@phosphor-icons/react'
import { invoke } from '@tauri-apps/api/core'
import { isTauri, mockInvoke } from '../mock-tauri'
import type { Settings, DeviceFlowStart, DeviceFlowPollResult, GitHubUser } from '../types'

function tauriCall<T>(cmd: string, args: Record<string, unknown> = {}): Promise<T> {
  return isTauri() ? invoke<T>(cmd, args) : mockInvoke<T>(cmd, args)
}

interface SettingsPanelProps {
  open: boolean
  settings: Settings
  onSave: (settings: Settings) => void
  onClose: () => void
}


interface KeyFieldProps {
  label: string
  placeholder: string
  value: string
  onChange: (value: string) => void
  onClear: () => void
}

function KeyField({ label, placeholder, value, onChange, onClear }: KeyFieldProps) {
  const [revealed, setRevealed] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--foreground)' }}>{label}</label>
      <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
        <input
          ref={inputRef}
          type={revealed ? 'text' : 'password'}
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full border border-border bg-transparent text-foreground rounded"
          style={{ fontSize: 13, padding: '8px 60px 8px 10px', outline: 'none', fontFamily: 'inherit' }}
          autoComplete="off"
          data-testid={`settings-key-${label.toLowerCase().replace(/\s+/g, '-')}`}
        />
        <div style={{ position: 'absolute', right: 8, display: 'flex', gap: 4, alignItems: 'center' }}>
          {value && (
            <>
              <button
                className="border-none bg-transparent p-1 text-muted-foreground cursor-pointer hover:text-foreground"
                onClick={() => setRevealed(r => !r)}
                title={revealed ? 'Hide key' : 'Reveal key'}
                type="button"
              >
                {revealed ? <EyeSlash size={14} /> : <Eye size={14} />}
              </button>
              <button
                className="border-none bg-transparent p-1 text-muted-foreground cursor-pointer hover:text-foreground"
                onClick={() => { onClear(); setRevealed(false) }}
                title="Clear key"
                type="button"
                data-testid={`clear-${label.toLowerCase().replace(/\s+/g, '-')}`}
              >
                <X size={14} />
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

type OAuthStatus = 'idle' | 'waiting' | 'error'

interface GitHubSectionProps {
  githubUsername: string | null
  githubToken: string | null
  onConnected: (token: string, username: string) => void
  onDisconnect: () => void
}

function GitHubSection({ githubUsername, githubToken, onConnected, onDisconnect }: GitHubSectionProps) {
  const [oauthStatus, setOauthStatus] = useState<OAuthStatus>('idle')
  const [userCode, setUserCode] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const pollingRef = useRef(false)
  const deviceCodeRef = useRef<string | null>(null)

  const isConnected = !!githubToken && !!githubUsername

  const stopPolling = useCallback(() => {
    pollingRef.current = false
    deviceCodeRef.current = null
  }, [])

  // Cleanup polling on unmount
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
      deviceCodeRef.current = flowStart.device_code

      // Open browser for user authorization
      window.open(flowStart.verification_uri, '_blank')

      // Start polling
      pollingRef.current = true
      const intervalMs = Math.max(flowStart.interval * 1000, 5000)

      const poll = async () => {
        while (pollingRef.current && deviceCodeRef.current) {
          await new Promise(r => setTimeout(r, intervalMs))
          if (!pollingRef.current) break

          try {
            const result = await tauriCall<DeviceFlowPollResult>('github_device_flow_poll', {
              deviceCode: deviceCodeRef.current,
            })

            if (result.status === 'complete' && result.access_token) {
              // Got the token — fetch user info
              const user = await tauriCall<GitHubUser>('github_get_user', {
                token: result.access_token,
              })
              stopPolling()
              setOauthStatus('idle')
              setUserCode(null)
              onConnected(result.access_token, user.login)
              return
            }

            if (result.status === 'expired') {
              stopPolling()
              setOauthStatus('error')
              setErrorMessage('Authorization expired. Please try again.')
              return
            }

            if (result.status === 'error') {
              stopPolling()
              setOauthStatus('error')
              setErrorMessage(result.error ?? 'Authorization failed.')
              return
            }
            // status === 'pending' → continue polling
          } catch (err) {
            stopPolling()
            setOauthStatus('error')
            setErrorMessage(err instanceof Error ? err.message : 'Polling failed.')
            return
          }
        }
      }

      poll()
    } catch (err) {
      setOauthStatus('error')
      setErrorMessage(err instanceof Error ? err.message : 'Failed to start login.')
    }
  }, [onConnected, stopPolling])

  const handleCancel = useCallback(() => {
    stopPolling()
    setOauthStatus('idle')
    setUserCode(null)
    setErrorMessage(null)
  }, [stopPolling])

  const handleDisconnect = useCallback(() => {
    stopPolling()
    setOauthStatus('idle')
    setUserCode(null)
    setErrorMessage(null)
    onDisconnect()
  }, [onDisconnect, stopPolling])

  // Connected state
  if (isConnected && oauthStatus === 'idle') {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div
          className="flex items-center gap-2 border border-border rounded px-3 py-2 flex-1"
          style={{ minHeight: 36 }}
          data-testid="github-connected"
        >
          <GithubLogo size={16} weight="fill" style={{ color: 'var(--foreground)' }} />
          <span style={{ fontSize: 13, color: 'var(--foreground)', fontWeight: 500 }}>
            {githubUsername}
          </span>
          <span style={{ fontSize: 12, color: 'var(--muted-foreground)' }}>Connected</span>
        </div>
        <button
          className="border border-border bg-transparent text-muted-foreground rounded cursor-pointer hover:text-foreground hover:border-foreground"
          style={{ fontSize: 12, padding: '6px 12px', display: 'flex', alignItems: 'center', gap: 4 }}
          onClick={handleDisconnect}
          title="Disconnect GitHub account"
          data-testid="github-disconnect"
        >
          <SignOut size={14} />
          Disconnect
        </button>
      </div>
    )
  }

  // Waiting for authorization
  if (oauthStatus === 'waiting' && userCode) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }} data-testid="github-waiting">
        <div
          className="border border-border rounded px-4 py-3"
          style={{ display: 'flex', flexDirection: 'column', gap: 8, textAlign: 'center' }}
        >
          <div style={{ fontSize: 12, color: 'var(--muted-foreground)' }}>
            Enter this code on GitHub:
          </div>
          <div
            style={{
              fontSize: 24,
              fontWeight: 700,
              letterSpacing: 4,
              color: 'var(--foreground)',
              fontFamily: 'monospace',
            }}
            data-testid="github-user-code"
          >
            {userCode}
          </div>
          <div className="flex items-center justify-center gap-2" style={{ fontSize: 12, color: 'var(--muted-foreground)' }}>
            <CircleNotch size={14} className="animate-spin" />
            Waiting for authorization...
          </div>
        </div>
        <button
          className="border border-border bg-transparent text-muted-foreground rounded cursor-pointer hover:text-foreground"
          style={{ fontSize: 12, padding: '6px 12px', alignSelf: 'center' }}
          onClick={handleCancel}
          data-testid="github-cancel"
        >
          Cancel
        </button>
      </div>
    )
  }

  // Idle / error state — show login button
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <button
        className="border-none rounded cursor-pointer flex items-center justify-center gap-2"
        style={{
          fontSize: 13,
          fontWeight: 500,
          padding: '8px 16px',
          background: 'var(--foreground)',
          color: 'var(--background)',
          height: 36,
        }}
        onClick={handleLogin}
        disabled={oauthStatus === 'waiting'}
        data-testid="github-login"
      >
        <GithubLogo size={16} weight="fill" />
        Login with GitHub
      </button>
      {errorMessage && (
        <div style={{ fontSize: 12, color: 'var(--destructive, #e03e3e)' }} data-testid="github-error">
          {errorMessage}
        </div>
      )}
    </div>
  )
}

export function SettingsPanel({ open, settings, onSave, onClose }: SettingsPanelProps) {
  if (!open) return null
  return <SettingsPanelInner settings={settings} onSave={onSave} onClose={onClose} />
}

function SettingsPanelInner({ settings, onSave, onClose }: Omit<SettingsPanelProps, 'open'>) {
  const [anthropicKey, setAnthropicKey] = useState(settings.anthropic_key ?? '')
  const [openaiKey, setOpenaiKey] = useState(settings.openai_key ?? '')
  const [googleKey, setGoogleKey] = useState(settings.google_key ?? '')
  // GitHub token/username managed via OAuth flow, not manual input
  const [githubToken, setGithubToken] = useState(settings.github_token)
  const [githubUsername, setGithubUsername] = useState(settings.github_username)

  const buildSettings = useCallback((): Settings => ({
    anthropic_key: anthropicKey.trim() || null,
    openai_key: openaiKey.trim() || null,
    google_key: googleKey.trim() || null,
    github_token: githubToken ?? null,
    github_username: githubUsername ?? null,
  }), [anthropicKey, openaiKey, googleKey, githubToken, githubUsername])

  const handleSave = () => {
    onSave(buildSettings())
    onClose()
  }

  const handleGitHubConnected = useCallback((token: string, username: string) => {
    setGithubToken(token)
    setGithubUsername(username)
    // Save immediately so the token persists even if the user doesn't click Save
    onSave({
      anthropic_key: anthropicKey.trim() || null,
      openai_key: openaiKey.trim() || null,
      google_key: googleKey.trim() || null,
      github_token: token,
      github_username: username,
    })
  }, [onSave, anthropicKey, openaiKey, googleKey])

  const handleGitHubDisconnect = useCallback(() => {
    setGithubToken(null)
    setGithubUsername(null)
    // Save immediately to clear the token
    onSave({
      anthropic_key: anthropicKey.trim() || null,
      openai_key: openaiKey.trim() || null,
      google_key: googleKey.trim() || null,
      github_token: null,
      github_username: null,
    })
  }, [onSave, anthropicKey, openaiKey, googleKey])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.stopPropagation()
      onClose()
    }
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault()
      handleSave()
    }
  }

  return (
    <div
      className="fixed inset-0 flex items-center justify-center z-50"
      style={{ background: 'rgba(0,0,0,0.4)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
      onKeyDown={handleKeyDown}
      data-testid="settings-panel"
    >
      <div
        className="bg-background border border-border rounded-lg shadow-xl"
        style={{ width: 520, maxHeight: '80vh', display: 'flex', flexDirection: 'column' }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between shrink-0"
          style={{ height: 56, padding: '0 24px', borderBottom: '1px solid var(--border)' }}
        >
          <span style={{ fontSize: 16, fontWeight: 600, color: 'var(--foreground)' }}>Settings</span>
          <button
            className="border-none bg-transparent p-1 text-muted-foreground cursor-pointer hover:text-foreground"
            onClick={onClose}
            title="Close settings"
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 20, overflow: 'auto' }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--foreground)', marginBottom: 4 }}>
              AI Provider Keys
            </div>
            <div style={{ fontSize: 12, color: 'var(--muted-foreground)', lineHeight: 1.5 }}>
              API keys are stored locally on your device. Never sent to our servers.
            </div>
          </div>

          <KeyField
            label="Anthropic"
            placeholder="sk-ant-..."
            value={anthropicKey}
            onChange={setAnthropicKey}
            onClear={() => setAnthropicKey('')}
          />
          <KeyField
            label="OpenAI"
            placeholder="sk-..."
            value={openaiKey}
            onChange={setOpenaiKey}
            onClear={() => setOpenaiKey('')}
          />
          <KeyField
            label="Google AI"
            placeholder="AIza..."
            value={googleKey}
            onChange={setGoogleKey}
            onClear={() => setGoogleKey('')}
          />

          <div style={{ height: 1, background: 'var(--border)' }} />

          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--foreground)', marginBottom: 4 }}>
              GitHub
            </div>
            <div style={{ fontSize: 12, color: 'var(--muted-foreground)', lineHeight: 1.5 }}>
              Connect your GitHub account to clone and sync vaults.
            </div>
          </div>

          <GitHubSection
            githubUsername={githubUsername ?? null}
            githubToken={githubToken ?? null}
            onConnected={handleGitHubConnected}
            onDisconnect={handleGitHubDisconnect}
          />
        </div>

        {/* Footer */}
        <div
          className="flex items-center justify-between shrink-0"
          style={{ height: 56, padding: '0 24px', borderTop: '1px solid var(--border)' }}
        >
          <span style={{ fontSize: 11, color: 'var(--muted-foreground)' }}>
            {'\u2318'}, to open settings
          </span>
          <div className="flex gap-2">
            <button
              className="border border-border bg-transparent text-foreground rounded cursor-pointer hover:bg-accent"
              style={{ fontSize: 13, padding: '6px 16px' }}
              onClick={onClose}
            >
              Cancel
            </button>
            <button
              className="border-none rounded cursor-pointer"
              style={{ fontSize: 13, padding: '6px 16px', background: 'var(--primary)', color: 'white' }}
              onClick={handleSave}
              data-testid="settings-save"
            >
              Save
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
