import type { CSSProperties } from 'react'
import { Download, ExternalLink, RefreshCw, X } from 'lucide-react'
import type { UpdateStatus, UpdateActions } from '../hooks/useUpdater'
import { restartApp } from '../hooks/useUpdater'
import { Button } from './ui/button'

interface UpdateBannerProps {
  status: UpdateStatus
  actions: UpdateActions
}

type VisibleUpdateStatus = Exclude<UpdateStatus, { state: 'idle' } | { state: 'error' }>

const bannerStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  padding: '6px 12px',
  background: 'var(--accent-blue)',
  borderBottom: 'none',
  fontSize: 13,
  color: 'var(--text-inverse)',
  flexShrink: 0,
} satisfies CSSProperties

const iconStyle = {
  color: 'var(--text-inverse)',
  flexShrink: 0,
} satisfies CSSProperties

const primaryActionStyle = {
  marginLeft: 'auto',
  padding: '3px 10px',
  background: 'var(--text-inverse)',
  color: 'var(--accent-blue)',
  fontSize: 12,
  fontWeight: 500,
} satisfies CSSProperties

const dismissButtonStyle = {
  color: 'var(--text-inverse)',
  display: 'flex',
  padding: 2,
} satisfies CSSProperties

const progressTrackStyle = {
  flex: 1,
  maxWidth: 200,
  height: 4,
  background: 'color-mix(in srgb, var(--text-inverse) 30%, transparent)',
  borderRadius: 2,
  overflow: 'hidden',
} satisfies CSSProperties

const progressTextStyle = {
  fontSize: 11,
  color: 'color-mix(in srgb, var(--text-inverse) 85%, transparent)',
} satisfies CSSProperties

const readyIconStyle = {
  color: 'var(--accent-green)',
  flexShrink: 0,
} satisfies CSSProperties

function renderAvailableContent(status: Extract<VisibleUpdateStatus, { state: 'available' }>, actions: UpdateActions) {
  return (
    <>
      <Download size={14} style={iconStyle} />
      <span>
        <strong>Tolaria {status.displayVersion}</strong> is available
      </span>
      <Button
        type="button"
        variant="link"
        size="xs"
        data-testid="update-release-notes"
        onClick={actions.openReleaseNotes}
        style={{ color: 'var(--text-inverse)', padding: 0, height: 'auto' }}
      >
        Release Notes <ExternalLink size={11} />
      </Button>
      <Button
        type="button"
        size="xs"
        data-testid="update-now-btn"
        onClick={actions.startDownload}
        style={primaryActionStyle}
      >
        Update Now
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon-xs"
        data-testid="update-dismiss"
        onClick={actions.dismiss}
        style={dismissButtonStyle}
        aria-label="Dismiss"
      >
        <X size={14} />
      </Button>
    </>
  )
}

function renderDownloadingContent(status: Extract<VisibleUpdateStatus, { state: 'downloading' }>) {
  return (
    <>
      <RefreshCw size={14} style={{ ...iconStyle, animation: 'spin 1s linear infinite' }} />
      <span>Downloading Tolaria {status.displayVersion}...</span>
      <div style={progressTrackStyle}>
        <div
          data-testid="update-progress"
          style={{
            width: `${Math.round(status.progress * 100)}%`,
            height: '100%',
            background: 'var(--text-inverse)',
            borderRadius: 2,
            transition: 'width 0.2s ease',
          }}
        />
      </div>
      <span style={progressTextStyle}>{Math.round(status.progress * 100)}%</span>
    </>
  )
}

function renderReadyContent(status: Extract<VisibleUpdateStatus, { state: 'ready' }>) {
  return (
    <>
      <RefreshCw size={14} style={readyIconStyle} />
      <span>
        <strong>Tolaria {status.displayVersion}</strong> is ready - restart to apply
      </span>
      <Button
        type="button"
        size="xs"
        data-testid="update-restart-btn"
        onClick={restartApp}
        style={{
          ...primaryActionStyle,
          background: 'var(--accent-green)',
          color: 'var(--text-inverse)',
        }}
      >
        Restart Now
      </Button>
    </>
  )
}

function renderBannerContent(status: VisibleUpdateStatus, actions: UpdateActions) {
  switch (status.state) {
    case 'available':
      return renderAvailableContent(status, actions)
    case 'downloading':
      return renderDownloadingContent(status)
    case 'ready':
      return renderReadyContent(status)
  }
}

export function UpdateBanner({ status, actions }: UpdateBannerProps) {
  if (status.state === 'idle' || status.state === 'error') return null

  return <div data-testid="update-banner" style={bannerStyle}>{renderBannerContent(status, actions)}</div>
}
