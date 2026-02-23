import { useState, useEffect, useRef } from 'react'
import { X, Eye, EyeSlash } from '@phosphor-icons/react'
import type { Settings } from '../types'

interface SettingsPanelProps {
  open: boolean
  settings: Settings
  onSave: (settings: Settings) => void
  onClose: () => void
}

function maskKey(key: string): string {
  if (key.length <= 8) return '•'.repeat(key.length)
  return key.slice(0, 7) + '•'.repeat(Math.min(key.length - 11, 12)) + key.slice(-4)
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

export function SettingsPanel({ open, settings, onSave, onClose }: SettingsPanelProps) {
  const [anthropicKey, setAnthropicKey] = useState('')
  const [openaiKey, setOpenaiKey] = useState('')
  const [googleKey, setGoogleKey] = useState('')
  const [githubToken, setGithubToken] = useState('')

  useEffect(() => {
    if (open) {
      setAnthropicKey(settings.anthropic_key ?? '')
      setOpenaiKey(settings.openai_key ?? '')
      setGoogleKey(settings.google_key ?? '')
      setGithubToken(settings.github_token ?? '')
    }
  }, [open, settings])

  if (!open) return null

  const handleSave = () => {
    const trimmed: Settings = {
      anthropic_key: anthropicKey.trim() || null,
      openai_key: openaiKey.trim() || null,
      google_key: googleKey.trim() || null,
      github_token: githubToken.trim() || null,
    }
    onSave(trimmed)
    onClose()
  }

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
              Personal access token for cloning and syncing vaults with GitHub.
            </div>
          </div>

          <KeyField
            label="GitHub Token"
            placeholder="ghp_... or gho_..."
            value={githubToken}
            onChange={setGithubToken}
            onClear={() => setGithubToken('')}
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

// Export maskKey for use in other components
export { maskKey }
