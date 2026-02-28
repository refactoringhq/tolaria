import { useState } from 'react'
import { FolderOpen, Plus, AlertTriangle, Loader2 } from 'lucide-react'

interface WelcomeScreenProps {
  mode: 'welcome' | 'vault-missing'
  missingPath?: string
  defaultVaultPath: string
  onCreateVault: () => void
  onOpenFolder: () => void
  creating: boolean
  error: string | null
}

const CONTAINER_STYLE: React.CSSProperties = {
  width: '100%',
  height: '100%',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: 'var(--sidebar)',
}

const CARD_STYLE: React.CSSProperties = {
  width: 520,
  background: 'var(--background)',
  borderRadius: 12,
  border: '1px solid var(--border)',
  padding: 48,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: 24,
}

const ICON_WRAP_STYLE: React.CSSProperties = {
  width: 64,
  height: 64,
  borderRadius: 16,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
}

const TITLE_STYLE: React.CSSProperties = {
  fontSize: 28,
  fontWeight: 700,
  letterSpacing: -0.5,
  color: 'var(--foreground)',
  textAlign: 'center',
  margin: 0,
}

const SUBTITLE_STYLE: React.CSSProperties = {
  fontSize: 14,
  lineHeight: 1.6,
  color: 'var(--muted-foreground)',
  textAlign: 'center',
  margin: 0,
}

const DIVIDER_STYLE: React.CSSProperties = {
  width: '100%',
  height: 1,
  background: 'var(--border)',
}

const PRIMARY_BTN_STYLE: React.CSSProperties = {
  width: '100%',
  height: 44,
  borderRadius: 8,
  border: 'none',
  background: 'var(--primary)',
  color: 'white',
  fontSize: 14,
  fontWeight: 600,
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 8,
}

const SECONDARY_BTN_STYLE: React.CSSProperties = {
  width: '100%',
  height: 44,
  borderRadius: 8,
  border: '1px solid var(--border)',
  background: 'var(--background)',
  color: 'var(--foreground)',
  fontSize: 14,
  fontWeight: 500,
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 8,
}

const HINT_STYLE: React.CSSProperties = {
  fontSize: 12,
  color: 'var(--muted-foreground)',
  textAlign: 'center',
  margin: 0,
}

const PATH_BADGE_STYLE: React.CSSProperties = {
  width: '100%',
  background: 'var(--sidebar)',
  borderRadius: 6,
  padding: '8px 12px',
  textAlign: 'center',
}

const ERROR_STYLE: React.CSSProperties = {
  fontSize: 13,
  color: 'var(--destructive, #e03e3e)',
  textAlign: 'center',
  margin: 0,
}

export function WelcomeScreen({ mode, missingPath, defaultVaultPath, onCreateVault, onOpenFolder, creating, error }: WelcomeScreenProps) {
  const [hoverPrimary, setHoverPrimary] = useState(false)
  const [hoverSecondary, setHoverSecondary] = useState(false)

  const isWelcome = mode === 'welcome'

  return (
    <div style={CONTAINER_STYLE} data-testid="welcome-screen">
      <div style={CARD_STYLE}>
        <div
          style={{
            ...ICON_WRAP_STYLE,
            background: isWelcome ? 'var(--accent-blue-light, #EBF4FF)' : 'var(--accent-yellow-light, #FFF3E0)',
          }}
        >
          {isWelcome
            ? <span style={{ fontSize: 28, color: 'var(--accent-blue)' }}>✦</span>
            : <AlertTriangle size={28} style={{ color: 'var(--accent-orange)' }} />
          }
        </div>

        <div style={{ textAlign: 'center' }}>
          <h1 style={TITLE_STYLE}>
            {isWelcome ? 'Welcome to Laputa' : 'Vault not found'}
          </h1>
          <p style={{ ...SUBTITLE_STYLE, marginTop: 8 }}>
            {isWelcome
              ? 'Wiki-linked knowledge management for deep thinkers.\nChoose how to get started.'
              : 'The vault folder could not be found on disk.\nIt may have been moved or deleted.'
            }
          </p>
        </div>

        {!isWelcome && missingPath && (
          <div style={PATH_BADGE_STYLE}>
            <code style={{ fontSize: 12, color: 'var(--muted-foreground)', fontFamily: 'var(--font-mono, monospace)' }}>
              {missingPath}
            </code>
          </div>
        )}

        <div style={DIVIDER_STYLE} />

        <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <button
            style={{
              ...PRIMARY_BTN_STYLE,
              opacity: creating ? 0.7 : hoverPrimary ? 0.9 : 1,
            }}
            onClick={onCreateVault}
            disabled={creating}
            onMouseEnter={() => setHoverPrimary(true)}
            onMouseLeave={() => setHoverPrimary(false)}
            data-testid="welcome-create-vault"
          >
            {creating ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
            {creating ? 'Creating vault…' : 'Create Getting Started vault'}
          </button>

          <button
            style={{
              ...SECONDARY_BTN_STYLE,
              background: hoverSecondary ? 'var(--sidebar)' : 'var(--background)',
            }}
            onClick={onOpenFolder}
            disabled={creating}
            onMouseEnter={() => setHoverSecondary(true)}
            onMouseLeave={() => setHoverSecondary(false)}
            data-testid="welcome-open-folder"
          >
            <FolderOpen size={16} />
            {isWelcome ? 'Open an existing folder' : 'Choose a different folder'}
          </button>
        </div>

        {error && <p style={ERROR_STYLE} data-testid="welcome-error">{error}</p>}

        {isWelcome && !error && (
          <p style={HINT_STYLE}>
            The Getting Started vault will be created in {defaultVaultPath}
          </p>
        )}
      </div>
    </div>
  )
}
