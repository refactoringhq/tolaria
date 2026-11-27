import { CaretDown, Cube } from '@phosphor-icons/react'
import { type ReactNode, type RefObject, useMemo, useRef, useState } from 'react'
import { ActionTooltip } from '@/components/ui/action-tooltip'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { ConfirmDeleteDialog } from '../ConfirmDeleteDialog'
import { type AppLocale, translate } from '../../lib/i18n'
import { workspaceLabelFromVault } from '../../utils/workspaces'
import type { VaultOption } from './types'
import { useDismissibleLayer } from './useDismissibleLayer'
import { buildVaultActions } from './vaultMenuActions'
import { useIncludedVaults, useVaultMenuInteractions } from './vaultMenuInteractions'
import { getVaultTriggerClassName } from './vaultMenuTrigger'
import { VaultMenuHeader, VaultMenuAction } from './VaultMenuRows'
import { VaultMenuList } from './VaultMenuList'
import type {
  VaultMenuPopoverProps,
  VaultMenuRemoveConfirmDialogProps,
  VaultMenuWorkspaceSectionProps,
} from './vaultMenuComponentTypes'
import type { VaultAction, VaultMenuProps } from './vaultMenuTypes'

function activeVaultDisplayLabel(vault: VaultOption | undefined, locale: AppLocale): string {
  return vault?.label
    ? workspaceLabelFromVault(vault)
    : translate(locale, 'status.vault.default')
}

function VaultMenuWorkspaceSection(props: VaultMenuWorkspaceSectionProps) {
  const { locale, onOpenVaultSettings, setOpen } = props
  const openSettings = onOpenVaultSettings
    ? () => {
        onOpenVaultSettings()
        setOpen(false)
      }
    : undefined

  return (
    <>
      <VaultMenuHeader locale={locale} onOpenVaultSettings={openSettings} />
      <div
        style={{
          height: 1,
          background: 'var(--border)',
          margin: '2px 0 4px',
        }}
      />
    </>
  )
}

function VaultMenuRemoveConfirmDialog(props: VaultMenuRemoveConfirmDialogProps) {
  const { locale, onRemoveVault, setOpen, setVaultPendingRemoval, vaultPendingRemoval } = props
  const closeDialog = () => setVaultPendingRemoval(null)
  const confirmRemoval = () => {
    if (vaultPendingRemoval) onRemoveVault?.(vaultPendingRemoval.path)
    setVaultPendingRemoval(null)
    setOpen(false)
  }

  return (
    <ConfirmDeleteDialog
      open={!!vaultPendingRemoval}
      title={translate(locale, 'status.vault.removeConfirmTitle')}
      message={translate(locale, 'status.vault.removeConfirmMessage', {
        label: vaultPendingRemoval?.label ?? '',
      })}
      confirmLabel={translate(locale, 'status.vault.removeConfirmAction')}
      onCancel={closeDialog}
      onConfirm={confirmRemoval}
    />
  )
}

function VaultMenuPopover(
  options: VaultMenuPopoverProps,
) {
  const {
    actions,
    canRemove,
    defaultPath,
    disableMountToggleForPath,
    locale,
    menuMinWidth,
    multiWorkspaceEnabled,
    onMountedChange,
    onOpenVaultSettings,
    onRemoveVault,
    onReorderVaults,
    onSelectVault,
    setOpen,
    setVaultPendingRemoval,
    sidebar,
    vaults,
  } = options
  const content = (
    <>
      {multiWorkspaceEnabled && (
        <VaultMenuWorkspaceSection
          locale={locale}
          onOpenVaultSettings={onOpenVaultSettings}
          setOpen={setOpen}
        />
      )}
      <VaultMenuList
        canRemove={canRemove}
        defaultPath={defaultPath}
        disableMountToggleForPath={disableMountToggleForPath}
        locale={locale}
        multiWorkspaceEnabled={multiWorkspaceEnabled}
        onMountedChange={onMountedChange}
        onRemoveVault={onRemoveVault}
        onReorderVaults={onReorderVaults}
        onSelectVault={onSelectVault}
        setVaultPendingRemoval={setVaultPendingRemoval}
        vaults={vaults}
      />
      {actions.length > 0 && <div style={{ height: 1, background: 'var(--border)', margin: '4px 0' }} />}
      {actions.map((action) => (
        <VaultMenuAction
          key={action.key}
          Icon={action.Icon}
          labelKey={action.labelKey}
          testId={action.testId}
          accent={action.accent}
          locale={locale}
          onClick={() => {
            action.onClick()
            setOpen(false)
          }}
        />
      ))}
    </>
  )
  return <VaultMenuPopup sidebar={sidebar} width={menuMinWidth}>{content}</VaultMenuPopup>
}

function VaultMenuPopup({ sidebar, width, children }: { sidebar?: boolean; width: number; children: ReactNode }) {
  if (sidebar) {
    return (
      <PopoverContent
        align="start"
        side="bottom"
        className="max-h-[var(--radix-popover-content-available-height)] max-w-[var(--radix-popover-content-available-width)] overflow-y-auto p-1.5"
        style={{ width: width }}
        data-testid="vault-menu-popover"
      >
        {children}
      </PopoverContent>
    )
  }

  return (
    <div
      style={{
        position: 'absolute',
        bottom: '100%',
        left: 0,
        marginBottom: 4,
        background: 'var(--sidebar)',
        border: '1px solid var(--border)',
        borderRadius: 6,
        padding: 6,
        minWidth: width,
        boxShadow: '0 4px 12px var(--shadow-dialog)',
        zIndex: 1000,
      }}
      data-testid="vault-menu-popover"
    >
      {children}
    </div>
  )
}

function useVaultMenuOpenState(controlledOpen: boolean | undefined, onOpenChange: VaultMenuProps['onOpenChange']) {
  const [open, setOpen] = useState(false)
  return { open: controlledOpen ?? open, setOpen: onOpenChange ?? setOpen }
}

export function VaultMenu(props: VaultMenuProps) {
  const {
    vaults,
    vaultPath,
    onSwitchVault,
    onOpenLocalFolder,
    onCreateEmptyVault,
    defaultWorkspacePath,
    onSetDefaultWorkspace,
    onOpenVaultSettings,
    onCloneVault,
    onCloneGettingStarted,
    onRemoveVault,
    multiWorkspaceEnabled = false,
    onReorderVaults,
    onUpdateWorkspaceIdentity,
    compact = false,
    sidebar = false,
    open: controlledOpen,
    onOpenChange,
    locale = 'en',
  } = props
  const { open, setOpen } = useVaultMenuOpenState(controlledOpen, onOpenChange)
  const [vaultPendingRemoval, setVaultPendingRemoval] = useState<VaultOption | null>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const defaultPath = multiWorkspaceEnabled ? (defaultWorkspacePath ?? vaultPath) : vaultPath
  const activeVault = vaults.find((vault) => vault.path === defaultPath)
  const canRemove = !!onRemoveVault && vaults.length > 1
  const activeVaultLabel = activeVaultDisplayLabel(activeVault, locale)
  const menuMinWidth = multiWorkspaceEnabled ? 340 : 220
  const includedVaults = useIncludedVaults(vaults, defaultPath)
  const { disableMountToggleForPath, handleMountedChange, handleSelectVault } = useVaultMenuInteractions({
    defaultPath,
    includedVaults,
    multiWorkspaceEnabled,
    onSetDefaultWorkspace,
    onSwitchVault,
    onUpdateWorkspaceIdentity,
    setOpen,
    vaultPath,
  })

  useDismissibleLayer(open && !sidebar, menuRef, () => setOpen(false))

  const actions = useMemo<VaultAction[]>(() => {
    return buildVaultActions({
      multiWorkspaceEnabled,
      onCreateEmptyVault,
      onCloneGettingStarted,
      onCloneVault,
      onOpenLocalFolder,
    })
  }, [multiWorkspaceEnabled, onCreateEmptyVault, onCloneGettingStarted, onCloneVault, onOpenLocalFolder])

  const popup = (
    <VaultMenuPopover
      actions={actions}
      canRemove={canRemove}
      defaultPath={defaultPath}
      disableMountToggleForPath={disableMountToggleForPath}
      locale={locale}
      menuMinWidth={menuMinWidth}
      multiWorkspaceEnabled={multiWorkspaceEnabled}
      onMountedChange={handleMountedChange}
      onOpenVaultSettings={onOpenVaultSettings}
      onRemoveVault={onRemoveVault}
      onReorderVaults={onReorderVaults}
      onSelectVault={handleSelectVault}
      setOpen={setOpen}
      setVaultPendingRemoval={setVaultPendingRemoval}
      sidebar={sidebar}
      vaults={vaults}
    />
  )
  const confirmRemoval = (
    <VaultMenuRemoveConfirmDialog
      locale={locale}
      onRemoveVault={onRemoveVault}
      setOpen={setOpen}
      setVaultPendingRemoval={setVaultPendingRemoval}
      vaultPendingRemoval={vaultPendingRemoval}
    />
  )
  return (
    <VaultMenuSurface
      sidebar={sidebar} locale={locale} open={open} setOpen={setOpen}
      activeVaultLabel={activeVaultLabel} compact={compact} menuRef={menuRef}
      content={{ popup, confirmRemoval }}
    />
  )
}

function VaultMenuSurface({ sidebar, locale, open, setOpen, activeVaultLabel, compact, menuRef, content }: {
  sidebar: boolean
  locale: AppLocale
  open: boolean
  setOpen: (open: boolean) => void
  activeVaultLabel: string
  compact: boolean
  menuRef: RefObject<HTMLDivElement | null>
  content: { popup: ReactNode; confirmRemoval: ReactNode }
}) {
  const { popup, confirmRemoval } = content
  return sidebar ? (
    <Popover open={open} onOpenChange={setOpen} modal>
      <PopoverTrigger asChild>
        <Button type="button" variant="ghost" size="sm"
          className="h-9 min-w-0 flex-1 justify-start gap-2 rounded-xl text-sidebar-foreground"
          style={{ paddingInlineStart: 12, paddingInlineEnd: 8 }}
          aria-label={translate(locale, 'status.vault.switch')} data-testid="status-vault-trigger">
          <Cube size={16} className="shrink-0" />
          <span className="truncate font-semibold">{activeVaultLabel}</span>
          <CaretDown size={12} className="shrink-0 text-muted-foreground" />
        </Button>
      </PopoverTrigger>
      {popup}
      {confirmRemoval}
    </Popover>
  ) : (
    <div ref={menuRef} style={{ position: 'relative' }}>
      <ActionTooltip copy={{ label: translate(locale, 'status.vault.switch') }} side="top">
        <Button type="button" variant="ghost" size={compact ? 'icon-xs' : 'xs'} className={getVaultTriggerClassName(open, compact)}
          onClick={() => setOpen(!open)} aria-label={translate(locale, 'status.vault.switch')} data-testid="status-vault-trigger">
          <Cube size={13} weight="regular" />
          {compact ? null : <span className="max-w-32 truncate">{activeVaultLabel}</span>}
        </Button>
      </ActionTooltip>
      {open && popup}
      {confirmRemoval}
    </div>
  )
}
