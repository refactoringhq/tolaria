import type { CSSProperties } from 'react'
import { Download, ExternalLink, RefreshCw, X } from 'lucide-react'
import type { UpdateStatus, UpdateActions } from '../hooks/useUpdater'
import { restartApp } from '../hooks/useUpdater'
import { t } from '../lib/i18n'
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
  background: '#1a56db',
  borderBottom: 'none',
  fontSize: 13,
  color: '#fff',
  flexShrink: 0,
} satisfies CSSProperties

const iconStyle = {
  color: '#fff',
  flexShrink: 0,
} satisfies CSSProperties

const primaryActionStyle = {
  marginLeft: 'auto',
  padding: '3px 10px',
  background: 'var(--primary)',
  color: '#fff',
  fontSize: 12,
  fontWeight: 500,
} satisfies CSSProperties

const dismissButtonStyle = {
  color: '#fff',
  display: 'flex',
  padding: 2,
} satisfies CSSProperties

const progressTrackStyle = {
  flex: 1,
  maxWidth: 200,
  height: 4,
  background: 'rgba(255,255,255,0.3)',
  borderRadius: 2,
  overflow: 'hidden',
} satisfies CSSProperties

const progressTextStyle = {
  fontSize: 11,
  color: 'rgba(255,255,255,0.85)',
} satisfies CSSProperties

const readyIconStyle = {
  color: 'var(--accent-green, #0F7B0F)',
  flexShrink: 0,
} satisfies CSSProperties

function renderAvailableContent(status: Extract<VisibleUpdateStatus, { state: 'available' }>, actions: UpdateActions) {
  return (
    <>
      <Download size={14} style={iconStyle} />
      <span>
        {t('Tolaria {displayVersion} is available', { displayVersion: status.displayVersion })}
      </span>
      <Button
        type="button"
        variant="link"
        size="xs"
        data-testid="update-release-notes"
        onClick={actions.openReleaseNotes}
        style={{ color: '#fff', padding: 0, height: 'auto' }}
      >
        {t('Release Notes')} <ExternalLink size={11} />
      </Button>
      <Button
        type="button"
        size="xs"
        data-testid="update-now-btn"
        onClick={actions.startDownload}
        style={primaryActionStyle}
      >
        {t('Update Now')}
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon-xs"
        data-testid="update-dismiss"
        onClick={actions.dismiss}
        style={dismissButtonStyle}
        aria-label={t('Dismiss')}
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
      <span>{t('Downloading Tolaria {displayVersion}...', { displayVersion: status.displayVersion })}</span>
      <div style={progressTrackStyle}>
        <div
          data-testid="update-progress"
          style={{
            width: `${Math.round(status.progress * 100)}%`,
            height: '100%',
            background: 'var(--primary)',
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
        {t('Tolaria {displayVersion} is ready - restart to apply', { displayVersion: status.displayVersion })}
      </span>
      <Button
        type="button"
        size="xs"
        data-testid="update-restart-btn"
        onClick={restartApp}
        style={{
          ...primaryActionStyle,
          background: 'var(--accent-green, #0F7B0F)',
        }}
      >
        {t('Restart Now')}
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
