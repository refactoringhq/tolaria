import { useState } from 'react'
import type { ReactNode } from 'react'
import { FolderOpen, Plus, AlertTriangle, Loader2, Rocket } from 'lucide-react'
import { useDragRegion } from '../hooks/useDragRegion'

interface WelcomeScreenProps {
  mode: 'welcome' | 'vault-missing'
  missingPath?: string
  defaultVaultPath: string
  onCreateVault: () => void
  onRetryCreateVault: () => void
  onCreateNewVault: () => void
  onOpenFolder: () => void
  isOffline: boolean
  creatingAction: 'template' | 'empty' | null
  error: string | null
  canRetryTemplate: boolean
}

interface WelcomeScreenPresentation {
  heroBackground: string
  heroIcon: ReactNode
  openFolderLabel: string
  subtitle: string
  templateDescription: string
  title: string
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

const OPTION_BTN_STYLE: React.CSSProperties = {
  width: '100%',
  borderRadius: 8,
  border: '1px solid var(--border)',
  background: 'var(--background)',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  gap: 14,
  padding: '14px 16px',
  textAlign: 'left',
  transition: 'background 0.15s',
}

const OPTION_ICON_STYLE: React.CSSProperties = {
  width: 36,
  height: 36,
  borderRadius: 8,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  flexShrink: 0,
}

const OPTION_LABEL_STYLE: React.CSSProperties = {
  fontSize: 14,
  fontWeight: 600,
  color: 'var(--foreground)',
  margin: 0,
}

const OPTION_DESC_STYLE: React.CSSProperties = {
  fontSize: 12,
  color: 'var(--muted-foreground)',
  margin: 0,
  marginTop: 2,
}

const ERROR_STYLE: React.CSSProperties = {
  fontSize: 13,
  color: 'var(--destructive, #e03e3e)',
  textAlign: 'center',
  margin: 0,
}

const STATUS_STYLE: React.CSSProperties = {
  fontSize: 13,
  color: 'var(--muted-foreground)',
  textAlign: 'center',
  margin: 0,
}

const ERROR_BLOCK_STYLE: React.CSSProperties = {
  width: '100%',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: 10,
}

const RETRY_BUTTON_STYLE: React.CSSProperties = {
  borderRadius: 8,
  border: '1px solid var(--border)',
  background: 'var(--background)',
  color: 'var(--foreground)',
  cursor: 'pointer',
  padding: '8px 12px',
  fontSize: 13,
  fontWeight: 600,
}

interface OptionButtonProps {
  icon: React.ReactNode
  iconBg: string
  label: string
  description: string
  loadingLabel?: string
  loadingDescription?: string
  onClick: () => void
  disabled: boolean
  loading?: boolean
  testId: string
  autoFocus?: boolean
}

function OptionButton({
  icon,
  iconBg,
  label,
  description,
  loadingLabel,
  loadingDescription,
  onClick,
  disabled,
  loading,
  testId,
  autoFocus = false,
}: OptionButtonProps) {
  const [hover, setHover] = useState(false)
  return (
    <button
      type="button"
      style={{
        ...OPTION_BTN_STYLE,
        background: hover ? 'var(--sidebar)' : 'var(--background)',
        opacity: disabled ? 0.7 : 1,
      }}
      onClick={onClick}
      disabled={disabled}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      data-testid={testId}
      autoFocus={autoFocus}
    >
      <div style={{ ...OPTION_ICON_STYLE, background: iconBg }}>
        {loading ? <Loader2 size={18} className="animate-spin" style={{ color: 'var(--muted-foreground)' }} /> : icon}
      </div>
      <div>
        <p style={OPTION_LABEL_STYLE}>{loading ? (loadingLabel ?? label) : label}</p>
        <p style={OPTION_DESC_STYLE}>{loading ? (loadingDescription ?? description) : description}</p>
      </div>
    </button>
  )
}

function getWelcomeScreenPresentation(
  mode: WelcomeScreenProps['mode'],
  defaultVaultPath: string,
  isOffline: boolean,
): WelcomeScreenPresentation {
  if (mode === 'welcome') {
    return {
      heroBackground: 'var(--accent-blue-light, #EBF4FF)',
      heroIcon: <span style={{ fontSize: 28, color: 'var(--accent-blue)' }}>&#10022;</span>,
      openFolderLabel: 'Open existing vault',
      subtitle: 'Wiki-linked knowledge management for deep thinkers.\nChoose how to get started.',
      templateDescription: isOffline
        ? `Requires internet — clone later. Suggested path: ${defaultVaultPath}`
        : `Download the starter vault template — suggested path: ${defaultVaultPath}`,
      title: 'Welcome to Tolaria',
    }
  }

  return {
    heroBackground: 'var(--accent-yellow-light, #FFF3E0)',
    heroIcon: <AlertTriangle size={28} style={{ color: 'var(--accent-orange)' }} />,
    openFolderLabel: 'Choose a different folder',
    subtitle: 'The vault folder could not be found on disk.\nIt may have been moved or deleted.',
    templateDescription: isOffline
      ? `Requires internet — clone later. Suggested path: ${defaultVaultPath}`
      : `Download the starter vault template — suggested path: ${defaultVaultPath}`,
    title: 'Vault not found',
  }
}

export function WelcomeScreen({
  mode,
  defaultVaultPath,
  onCreateVault,
  onRetryCreateVault,
  onCreateNewVault,
  onOpenFolder,
  isOffline,
  creatingAction,
  error,
  canRetryTemplate,
}: WelcomeScreenProps) {
  const busy = creatingAction !== null
  const presentation = getWelcomeScreenPresentation(mode, defaultVaultPath, isOffline)
  const { onMouseDown } = useDragRegion()

  return (
    <div style={CONTAINER_STYLE} data-testid="welcome-screen" onMouseDown={onMouseDown}>
      <div style={CARD_STYLE} data-no-drag>
        <div
          style={{
            ...ICON_WRAP_STYLE,
            background: presentation.heroBackground,
          }}
        >
          {presentation.heroIcon}
        </div>

        <div style={{ textAlign: 'center' }}>
          <h1 style={TITLE_STYLE}>{presentation.title}</h1>
          <p style={{ ...SUBTITLE_STYLE, marginTop: 8 }}>
            {presentation.subtitle}
          </p>
        </div>

        <div style={DIVIDER_STYLE} />

        <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <OptionButton
            icon={<Plus size={18} style={{ color: 'var(--accent-blue)' }} />}
            iconBg="var(--accent-blue-light, #EBF4FF)"
            label="Create a new vault"
            description="Start fresh in a folder you choose"
            loadingLabel="Creating vault…"
            loadingDescription="Preparing an empty vault in the selected folder"
            onClick={onCreateNewVault}
            disabled={busy}
            loading={creatingAction === 'empty'}
            testId="welcome-create-new"
            autoFocus
          />

          <OptionButton
            icon={<FolderOpen size={18} style={{ color: 'var(--accent-green)' }} />}
            iconBg="var(--accent-green-light, #E8F5E9)"
            label={presentation.openFolderLabel}
            description="Point to a folder you already have"
            onClick={onOpenFolder}
            disabled={busy}
            testId="welcome-open-folder"
          />

          <OptionButton
            icon={<Rocket size={18} style={{ color: 'var(--accent-purple)' }} />}
            iconBg="var(--accent-purple-light, #F3E8FF)"
            label="Get started with a template"
            description={presentation.templateDescription}
            loadingLabel="Downloading template…"
            loadingDescription="Cloning the Getting Started vault template"
            onClick={onCreateVault}
            disabled={busy || isOffline}
            loading={creatingAction === 'template'}
            testId="welcome-create-vault"
          />
        </div>

        {creatingAction === 'template' && (
          <p style={STATUS_STYLE} data-testid="welcome-status" role="status" aria-live="polite">
            Downloading the Getting Started vault template…
          </p>
        )}

        {error && (
          <div style={ERROR_BLOCK_STYLE}>
            <p style={ERROR_STYLE} data-testid="welcome-error" role="alert" aria-live="assertive">
              {error}
            </p>
            {canRetryTemplate && (
              <button
                type="button"
                style={RETRY_BUTTON_STYLE}
                onClick={onRetryCreateVault}
                data-testid="welcome-retry-template"
              >
                Retry download
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
