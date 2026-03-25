import { ShieldCheck } from '@phosphor-icons/react'

interface TelemetryConsentDialogProps {
  onAccept: () => void
  onDecline: () => void
}

export function TelemetryConsentDialog({ onAccept, onDecline }: TelemetryConsentDialogProps) {
  return (
    <div
      className="fixed inset-0 flex items-center justify-center z-50"
      style={{ background: 'rgba(0,0,0,0.4)' }}
    >
      <div
        className="bg-background border border-border rounded-lg shadow-xl"
        style={{ width: 440, padding: 32, display: 'flex', flexDirection: 'column', gap: 20, alignItems: 'center' }}
      >
        <ShieldCheck size={40} weight="duotone" style={{ color: 'var(--primary)' }} />

        <div style={{ textAlign: 'center' }}>
          <h2 style={{ fontSize: 18, fontWeight: 600, color: 'var(--foreground)', margin: 0 }}>
            Help improve Laputa
          </h2>
          <p style={{ fontSize: 13, color: 'var(--muted-foreground)', lineHeight: 1.6, marginTop: 8 }}>
            Send anonymous crash reports to help us fix bugs faster.
            No vault content, no personal data, no tracking.
          </p>
        </div>

        <div style={{ fontSize: 12, color: 'var(--muted-foreground)', lineHeight: 1.6, width: '100%' }}>
          <p style={{ margin: '0 0 6px', fontWeight: 500, color: 'var(--foreground)' }}>What we collect:</p>
          <ul style={{ margin: 0, paddingLeft: 18 }}>
            <li>Stack traces from errors (JS &amp; Rust)</li>
            <li>App version, OS, and architecture</li>
          </ul>
          <p style={{ margin: '10px 0 6px', fontWeight: 500, color: 'var(--foreground)' }}>What we never collect:</p>
          <ul style={{ margin: 0, paddingLeft: 18 }}>
            <li>No vault content, note titles, or file paths</li>
            <li>No personal data or IP addresses</li>
          </ul>
        </div>

        <div style={{ display: 'flex', gap: 12, width: '100%', marginTop: 4 }}>
          <button
            className="border border-border bg-transparent text-foreground rounded cursor-pointer hover:bg-accent"
            style={{ flex: 1, fontSize: 13, padding: '10px 16px' }}
            onClick={onDecline}
            data-testid="telemetry-decline"
          >
            No thanks
          </button>
          <button
            className="border-none rounded cursor-pointer"
            style={{ flex: 1, fontSize: 13, padding: '10px 16px', background: 'var(--primary)', color: 'white', fontWeight: 500 }}
            onClick={onAccept}
            data-testid="telemetry-accept"
          >
            Allow anonymous reporting
          </button>
        </div>

        <p style={{ fontSize: 11, color: 'var(--muted-foreground)', margin: 0, textAlign: 'center' }}>
          You can change this anytime in Settings.
        </p>
      </div>
    </div>
  )
}
