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

// --- GitHub OAuth Section ---

type OAuthStatus = 'idle' | 'waiting' | 'error'

interface GitHubSectionProps {
  githubUsername: string | null
  githubToken: string | null
  onConnected: (token: string, username: string) => void
  onDisconnect: () => void
}

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
  return 'continue' // status === 'pending'
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
      window.open(flowStart.verification_uri, '_blank')

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
    setErrorMessage(null)
  }, [stopPolling])

  if (isConnected && oauthStatus === 'idle') {
    return <GitHubConnectedRow username={githubUsername!} onDisconnect={() => { resetOAuth(); onDisconnect() }} />
  }

  if (oauthStatus === 'waiting' && userCode) {
    return <GitHubWaitingView userCode={userCode} onCancel={resetOAuth} />
  }

  return <GitHubLoginButton onLogin={handleLogin} disabled={oauthStatus === 'waiting'} errorMessage={errorMessage} />
}

function GitHubConnectedRow({ username, onDisconnect }: { username: string; onDisconnect: () => void }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      <div
        className="flex items-center gap-2 border border-border rounded px-3 py-2 flex-1"
        style={{ minHeight: 36 }}
        data-testid="github-connected"
      >
        <GithubLogo size={16} weight="fill" style={{ color: 'var(--foreground)' }} />
        <span style={{ fontSize: 13, color: 'var(--foreground)', fontWeight: 500 }}>{username}</span>
        <span style={{ fontSize: 12, color: 'var(--muted-foreground)' }}>Connected</span>
      </div>
      <button
        className="border border-border bg-transparent text-muted-foreground rounded cursor-pointer hover:text-foreground hover:border-foreground"
        style={{ fontSize: 12, padding: '6px 12px', display: 'flex', alignItems: 'center', gap: 4 }}
        onClick={onDisconnect}
        title="Disconnect GitHub account"
        data-testid="github-disconnect"
      >
        <SignOut size={14} />
        Disconnect
      </button>
    </div>
  )
}

function GitHubWaitingView({ userCode, onCancel }: { userCode: string; onCancel: () => void }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }} data-testid="github-waiting">
      <div
        className="border border-border rounded px-4 py-3"
        style={{ display: 'flex', flexDirection: 'column', gap: 8, textAlign: 'center' }}
      >
        <div style={{ fontSize: 12, color: 'var(--muted-foreground)' }}>Enter this code on GitHub:</div>
        <div
          style={{ fontSize: 24, fontWeight: 700, letterSpacing: 4, color: 'var(--foreground)', fontFamily: 'monospace' }}
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
        onClick={onCancel}
        data-testid="github-cancel"
      >
        Cancel
      </button>
    </div>
  )
}

function GitHubLoginButton({ onLogin, disabled, errorMessage }: { onLogin: () => void; disabled: boolean; errorMessage: string | null }) {
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
        <div style={{ fontSize: 12, color: 'var(--destructive, #e03e3e)' }} data-testid="github-error">
          {errorMessage}
        </div>
      )}
    </div>
  )
}

// --- Settings Panel ---

export function SettingsPanel({ open, settings, onSave, onClose }: SettingsPanelProps) {
  if (!open) return null
  return <SettingsPanelInner settings={settings} onSave={onSave} onClose={onClose} />
}

function SettingsPanelInner({ settings, onSave, onClose }: Omit<SettingsPanelProps, 'open'>) {
  const [anthropicKey, setAnthropicKey] = useState(settings.anthropic_key ?? '')
  const [openaiKey, setOpenaiKey] = useState(settings.openai_key ?? '')
  const [googleKey, setGoogleKey] = useState(settings.google_key ?? '')
  const [githubToken, setGithubToken] = useState(settings.github_token)
  const [githubUsername, setGithubUsername] = useState(settings.github_username)
  const [pullInterval, setPullInterval] = useState(settings.auto_pull_interval_minutes ?? 5)

  const buildSettings = useCallback((ghOverride?: { token: string | null; username: string | null }): Settings => ({
    anthropic_key: anthropicKey.trim() || null,
    openai_key: openaiKey.trim() || null,
    google_key: googleKey.trim() || null,
    github_token: ghOverride ? ghOverride.token : (githubToken ?? null),
    github_username: ghOverride ? ghOverride.username : (githubUsername ?? null),
    auto_pull_interval_minutes: pullInterval,
  }), [anthropicKey, openaiKey, googleKey, githubToken, githubUsername, pullInterval])

  const handleSave = () => {
    onSave(buildSettings())
    onClose()
  }

  const handleGitHubConnected = useCallback((token: string, username: string) => {
    setGithubToken(token)
    setGithubUsername(username)
    onSave(buildSettings({ token, username }))
  }, [onSave, buildSettings])

  const handleGitHubDisconnect = useCallback(() => {
    setGithubToken(null)
    setGithubUsername(null)
    onSave(buildSettings({ token: null, username: null }))
  }, [onSave, buildSettings])

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
        <SettingsHeader onClose={onClose} />
        <SettingsBody
          anthropicKey={anthropicKey} setAnthropicKey={setAnthropicKey}
          openaiKey={openaiKey} setOpenaiKey={setOpenaiKey}
          googleKey={googleKey} setGoogleKey={setGoogleKey}
          githubToken={githubToken ?? null} githubUsername={githubUsername ?? null}
          onGitHubConnected={handleGitHubConnected} onGitHubDisconnect={handleGitHubDisconnect}
          pullInterval={pullInterval} setPullInterval={setPullInterval}
        />
        <SettingsFooter onClose={onClose} onSave={handleSave} />
      </div>
    </div>
  )
}

function SettingsHeader({ onClose }: { onClose: () => void }) {
  return (
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
  )
}

interface SettingsBodyProps {
  anthropicKey: string; setAnthropicKey: (v: string) => void
  openaiKey: string; setOpenaiKey: (v: string) => void
  googleKey: string; setGoogleKey: (v: string) => void
  githubToken: string | null; githubUsername: string | null
  onGitHubConnected: (token: string, username: string) => void
  onGitHubDisconnect: () => void
  pullInterval: number; setPullInterval: (v: number) => void
}

function SettingsBody(props: SettingsBodyProps) {
  return (
    <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 20, overflow: 'auto' }}>
      <div>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--foreground)', marginBottom: 4 }}>AI Provider Keys</div>
        <div style={{ fontSize: 12, color: 'var(--muted-foreground)', lineHeight: 1.5 }}>
          API keys are stored locally on your device. Never sent to our servers.
        </div>
      </div>

      <KeyField label="Anthropic" placeholder="sk-ant-..." value={props.anthropicKey} onChange={props.setAnthropicKey} onClear={() => props.setAnthropicKey('')} />
      <KeyField label="OpenAI" placeholder="sk-..." value={props.openaiKey} onChange={props.setOpenaiKey} onClear={() => props.setOpenaiKey('')} />
      <KeyField label="Google AI" placeholder="AIza..." value={props.googleKey} onChange={props.setGoogleKey} onClear={() => props.setGoogleKey('')} />

      <div style={{ height: 1, background: 'var(--border)' }} />

      <div>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--foreground)', marginBottom: 4 }}>GitHub</div>
        <div style={{ fontSize: 12, color: 'var(--muted-foreground)', lineHeight: 1.5 }}>
          Connect your GitHub account to clone and sync vaults.
        </div>
      </div>

      <GitHubSection
        githubUsername={props.githubUsername}
        githubToken={props.githubToken}
        onConnected={props.onGitHubConnected}
        onDisconnect={props.onGitHubDisconnect}
      />

      <div style={{ height: 1, background: 'var(--border)' }} />

      <div>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--foreground)', marginBottom: 4 }}>Sync</div>
        <div style={{ fontSize: 12, color: 'var(--muted-foreground)', lineHeight: 1.5 }}>
          Automatically pull vault changes from Git in the background.
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--foreground)' }}>Pull interval (minutes)</label>
        <select
          value={props.pullInterval}
          onChange={(e) => props.setPullInterval(Number(e.target.value))}
          className="border border-border bg-transparent text-foreground rounded"
          style={{ fontSize: 13, padding: '8px 10px', outline: 'none', fontFamily: 'inherit' }}
          data-testid="settings-pull-interval"
        >
          <option value={1}>1</option>
          <option value={2}>2</option>
          <option value={5}>5</option>
          <option value={10}>10</option>
          <option value={15}>15</option>
          <option value={30}>30</option>
        </select>
      </div>
    </div>
  )
}

function SettingsFooter({ onClose, onSave }: { onClose: () => void; onSave: () => void }) {
  return (
    <div
      className="flex items-center justify-between shrink-0"
      style={{ height: 56, padding: '0 24px', borderTop: '1px solid var(--border)' }}
    >
      <span style={{ fontSize: 11, color: 'var(--muted-foreground)' }}>{'\u2318'}, to open settings</span>
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
          onClick={onSave}
          data-testid="settings-save"
        >
          Save
        </button>
      </div>
    </div>
  )
}
