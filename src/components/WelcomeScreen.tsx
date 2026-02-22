import { useState } from 'react'
import { FolderOpen, Plus, AlertCircle } from 'lucide-react'

interface WelcomeScreenProps {
  onOpenFolder: () => void
  onCreateVault: () => void
  error: string | null
}

export function WelcomeScreen({ onOpenFolder, onCreateVault, error }: WelcomeScreenProps) {
  const [hoveredButton, setHoveredButton] = useState<'open' | 'create' | null>(null)

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      height: '100vh',
      width: '100vw',
      background: 'var(--sidebar)',
      color: 'var(--foreground)',
      fontFamily: 'inherit',
    }}>
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 32,
        maxWidth: 420,
        textAlign: 'center',
      }}>
        <h1 style={{
          fontSize: 28,
          fontWeight: 600,
          margin: 0,
          color: 'var(--foreground)',
        }}>
          Welcome to Laputa
        </h1>
        <p style={{
          fontSize: 14,
          color: 'var(--muted-foreground)',
          margin: 0,
          lineHeight: 1.6,
        }}>
          Open a folder of markdown files to get started, or create a new vault.
        </p>

        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
          width: '100%',
          maxWidth: 300,
        }}>
          <button
            onClick={onOpenFolder}
            onMouseEnter={() => setHoveredButton('open')}
            onMouseLeave={() => setHoveredButton(null)}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              padding: '10px 20px',
              borderRadius: 6,
              border: 'none',
              background: hoveredButton === 'open' ? 'var(--primary)' : 'var(--primary)',
              color: 'var(--primary-foreground)',
              fontSize: 14,
              fontWeight: 500,
              cursor: 'pointer',
              opacity: hoveredButton === 'open' ? 0.9 : 1,
              transition: 'opacity 0.15s',
            }}
          >
            <FolderOpen size={16} />
            Open Existing Folder
          </button>

          <button
            onClick={onCreateVault}
            onMouseEnter={() => setHoveredButton('create')}
            onMouseLeave={() => setHoveredButton(null)}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              padding: '10px 20px',
              borderRadius: 6,
              border: '1px solid var(--border)',
              background: hoveredButton === 'create' ? 'var(--bg-hover)' : 'var(--background)',
              color: 'var(--foreground)',
              fontSize: 14,
              fontWeight: 500,
              cursor: 'pointer',
              transition: 'background 0.15s',
            }}
          >
            <Plus size={16} />
            Create New Vault
          </button>
        </div>

        {error && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '8px 12px',
            borderRadius: 6,
            background: 'var(--destructive)',
            color: 'var(--destructive-foreground)',
            fontSize: 13,
            width: '100%',
            maxWidth: 300,
          }}>
            <AlertCircle size={14} style={{ flexShrink: 0 }} />
            {error}
          </div>
        )}
      </div>
    </div>
  )
}
