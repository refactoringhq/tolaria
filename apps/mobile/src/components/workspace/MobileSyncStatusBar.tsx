import { FolderOpen, Tray } from 'phosphor-react-native'
import { StyleSheet, View } from 'react-native'
import { Text } from '../ui/text'
import { mobileText } from '../../i18n/mobileText'
import { MobileButton } from '../../ui/MobileButton'
import { desktopStatusBarParity } from '../../ui/desktopParity'
import { mobileColors } from '../../ui/tokens'
import type { MobileSyncStatus } from '../../workspace/mobileWorkspaceModel'
import { useVaultSyncPresentation } from '../vaults/useVaultSyncPresentation'

export function MobileSyncStatusBar({
  onOpenLocalVault,
  sync,
}: {
  onOpenLocalVault?: () => void
  sync: MobileSyncStatus
}) {
  const vault = useVaultSyncPresentation(sync)
  const action = statusBarAction(onOpenLocalVault)

  return (
    <View style={styles.syncBar} testID="sync-status-bar">
      <View style={styles.syncStatusGroup}>
        <Tray color={vault?.color ?? syncStatusColor(sync)} size={desktopStatusBarParity.iconSize} />
        <Text numberOfLines={1} style={styles.syncStatusText} testID="sync-status-label">{vault?.label ?? syncStatusLabel(sync)}</Text>
        {!vault && <Text numberOfLines={1} style={styles.syncDetailText} testID="sync-status-detail">{syncStatusDetail(sync)}</Text>}
      </View>
      {vault?.sync && <MobileButton density="status" disabled={vault.busy} icon={<Tray color={mobileColors.textMuted} size={desktopStatusBarParity.iconSize} />} label={mobileText('status.sync.now')} onPress={() => { void vault.sync?.() }} variant="ghost" />}
      <MobileButton
        density="status"
        icon={action.icon}
        label={vault ? mobileText('status.vault.manageWorkspaces') : action.label}
        onPress={vault ? () => { void vault.open() } : action.onPress}
        variant="ghost"
      />
    </View>
  )
}

function statusBarAction(onOpenLocalVault: (() => void) | undefined) {
  if (!onOpenLocalVault) {
    return {
      icon: <Tray color={mobileColors.textMuted} size={desktopStatusBarParity.iconSize} />,
      label: mobileText('status.sync.now'),
      onPress: undefined,
    }
  }

  return {
    icon: <FolderOpen color={mobileColors.textMuted} size={desktopStatusBarParity.iconSize} />,
    label: mobileText('status.vault.openLocal'),
    onPress: onOpenLocalVault,
  }
}

function syncStatusColor(sync: MobileSyncStatus) {
  if (sync.kind === 'noVault' || sync.kind === 'readOnly') return mobileColors.textMuted
  if (sync.kind === 'conflict') return mobileColors.danger
  if (sync.kind === 'writeFailed') return mobileColors.danger
  if (sync.kind === 'pullRequired') return mobileColors.orange

  return mobileColors.green
}

function syncStatusDetail(sync: MobileSyncStatus) {
  if (sync.kind === 'noVault') return mobileText('status.vault.openLocal')
  if (sync.kind === 'readOnly') return mobileText('status.sync.notSynced')
  if (sync.kind === 'conflict') return mobileText('status.sync.resolveConflicts')
  if (sync.kind === 'writeFailed') return mobileText('status.sync.failed')
  if (sync.kind === 'pullRequired') return mobileText('status.sync.pullAndPush')
  if (sync.minutesAgo) return mobileText('status.sync.minutesAgo').replace('{minutes}', `${sync.minutesAgo}`)

  return mobileText('status.sync.justNow')
}

function syncStatusLabel(sync: MobileSyncStatus) {
  if (sync.kind === 'noVault') return mobileText('status.vault.default')
  if (sync.kind === 'readOnly') return mobileText('status.vault.default')
  if (sync.kind === 'conflict') return mobileText('status.sync.conflict')
  if (sync.kind === 'writeFailed') return mobileText('status.sync.notSynced')
  if (sync.kind === 'pullRequired') return mobileText('status.sync.pullRequired')

  return mobileText('status.sync.synced')
}

const styles = StyleSheet.create({
  syncBar: {
    alignItems: 'center',
    backgroundColor: mobileColors.sidebar,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: mobileColors.border,
    flexDirection: 'row',
    gap: desktopStatusBarParity.primaryGap,
    height: desktopStatusBarParity.height,
    justifyContent: 'space-between',
    minHeight: desktopStatusBarParity.height,
    paddingHorizontal: desktopStatusBarParity.paddingHorizontal,
  },
  syncDetailText: {
    color: mobileColors.textMuted,
    fontSize: desktopStatusBarParity.fontSize,
  },
  syncStatusGroup: {
    alignItems: 'center',
    flex: 1,
    flexDirection: 'row',
    gap: desktopStatusBarParity.sectionGap,
    minWidth: 0,
  },
  syncStatusText: {
    color: mobileColors.textMuted,
    fontSize: desktopStatusBarParity.fontSize,
    fontWeight: '500',
  },
})
