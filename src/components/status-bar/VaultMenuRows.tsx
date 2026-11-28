import { createElement } from 'react'
import { Button } from '@/components/ui/button'
import { translate } from '../../lib/i18n'
import type { VaultMenuActionComponentProps, VaultMenuHeaderProps } from './vaultMenuComponentTypes'

export function VaultMenuHeader(props: VaultMenuHeaderProps) {
  const { locale, onOpenVaultSettings } = props
  return (
    <div className="flex items-center justify-between gap-3 px-2 py-2">
      <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {translate(locale, 'status.vault.availableHeader')}
      </span>
      {onOpenVaultSettings && (
        <Button
          type="button"
          variant="ghost"
          size="xs"
          className="h-auto rounded-sm px-1 py-0.5 text-xs font-medium text-muted-foreground hover:bg-[var(--hover)] hover:text-foreground"
          onClick={onOpenVaultSettings}
          data-testid="vault-menu-manage-vaults"
        >
          {translate(locale, 'status.vault.manageWorkspaces')}
        </Button>
      )}
    </div>
  )
}

export function VaultMenuAction(props: VaultMenuActionComponentProps) {
  const { Icon, labelKey, testId, accent = false, onClick, locale = 'en' } = props
  return (
    <Button
      type="button"
      variant="ghost"
      size="xs"
      onClick={onClick}
      className="h-auto w-full justify-start rounded-sm px-2 py-1.5 text-sm font-normal"
      style={{
        color: accent ? 'var(--accent-blue)' : 'var(--muted-foreground)',
      }}
      data-testid={testId}
    >
      {createElement(Icon, { size: 12 })}
      {translate(locale, labelKey)}
    </Button>
  )
}
