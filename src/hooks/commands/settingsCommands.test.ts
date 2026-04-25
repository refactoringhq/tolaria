import { describe, expect, it, vi } from 'vitest'
import { formatShortcutDisplay } from '../appCommandCatalog'
import { buildSettingsCommands } from './settingsCommands'

describe('buildSettingsCommands', () => {
  it('adds a discoverable H1 auto-rename settings command', () => {
    const onOpenSettings = vi.fn()

    const commands = buildSettingsCommands({ onOpenSettings })
    const command = commands.find((item) => item.id === 'open-h1-auto-rename-setting')

    expect(command).toMatchObject({
      label: 'Open H1 Auto-Rename Setting',
      enabled: true,
      group: 'Settings',
    })

    command?.execute()
    expect(onOpenSettings).toHaveBeenCalledTimes(1)
  })

  it('keeps the general settings command available', () => {
    const onOpenSettings = vi.fn()

    const commands = buildSettingsCommands({ onOpenSettings })

    expect(commands.find((item) => item.id === 'open-settings')).toMatchObject({
      label: 'Open Settings',
      shortcut: formatShortcutDisplay({ display: '⌘,' }),
      enabled: true,
    })
  })

  it('adds a create-empty-vault command when the handler is available', () => {
    const onOpenSettings = vi.fn()
    const onCreateEmptyVault = vi.fn()

    const commands = buildSettingsCommands({ onOpenSettings, onCreateEmptyVault })
    const command = commands.find((item) => item.id === 'create-empty-vault')

    expect(command).toMatchObject({
      label: 'Create Empty Vault…',
      enabled: true,
      group: 'Settings',
    })

    command?.execute()
    expect(onCreateEmptyVault).toHaveBeenCalledTimes(1)
  })
})
