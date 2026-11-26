import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { StatusBar } from './StatusBar'

describe('StatusBar vault label', () => {
  it('shows the folder name when the vault label is a Windows path', () => {
    const path = String.raw`C:\Users\mabachan\Documents\My Vault`

    render(
      <StatusBar
        noteCount={0}
        vaultPath={path}
        vaults={[{ label: path, path, mounted: true }]}
        onSwitchVault={vi.fn()}
      />,
    )

    expect(screen.getByText('My Vault')).toBeInTheDocument()
    expect(screen.queryByText(path)).not.toBeInTheDocument()
  })
})
