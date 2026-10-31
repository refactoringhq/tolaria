import { useState } from 'react'
import { StyleSheet, View } from 'react-native'
import { FolderOpen, GithubLogo, X } from 'phosphor-react-native'
import { Text } from '../ui/text'
import { MobileButton } from '../../ui/MobileButton'
import { MobileIconButton } from '../../ui/MobileIconButton'
import { mobileText } from '../../i18n/mobileText'
import { useMobileColors, useMobileStyles } from '../../ui/theme/useMobileTheme'
import type { useMobileVaults } from '../../workspace/git/useMobileVaults'
import { createVaultManagerStyles } from './vaultManagerStyles'
import { optionalNativeWorkspaceAccessModule } from '../../workspace/nativeWorkspaceAccess'

type Manager = ReturnType<typeof useMobileVaults>
type SavedVaultsManager = Pick<Manager, 'active' | 'busy' | 'openFolder' | 'select' | 'selectLocal' | 'forget'> & {
  catalog: Pick<Manager['catalog'], 'localVaults' | 'vaults'>
}

export function MobileSavedVaults({ manager }: { manager: SavedVaultsManager }) {
  const styles = useMobileStyles(createVaultManagerStyles)
  const colors = useMobileColors()
  const [removing, setRemoving] = useState<{ id: string; label: string } | null>(null)
  const vaults = [
    ...manager.catalog.localVaults.map(vault => ({ ...vault, kind: 'local', select: () => manager.selectLocal(vault) })),
    ...manager.catalog.vaults.map(vault => ({ ...vault, kind: 'git', select: () => manager.select(vault) })),
  ]
  return <View style={styles.section} testID="saved-vaults">
    <Text style={styles.label}>{mobileText('status.vault.availableHeader')}</Text>
    {vaults.map(vault => {
      const selected = manager.active.selection?.vaultAlias === vault.id
      return <View key={vault.id} style={rowStyles.row}>
        <MobileButton disabled={manager.busy} label={vault.label} accessibilityState={{ selected }}
          icon={vault.kind === 'git' ? <GithubLogo size={18} color={colors.textMuted} /> : <FolderOpen size={18} color={colors.textMuted} />}
          style={[styles.vault, rowStyles.select]} variant={selected ? 'secondary' : 'ghost'}
          onPress={() => { void vault.select() }} testID={`select-vault-${vault.id}`} />
        {!manager.busy && <MobileIconButton accessibilityLabel={mobileText('status.vault.remove').replace('{label}', vault.label)}
          onPress={() => setRemoving(vault)} testID={`forget-vault-${vault.id}`}><X size={16} color={colors.textMuted} /></MobileIconButton>}
      </View>
    })}
    <MobileButton disabled={manager.busy} label={mobileText('status.vault.openLocal')}
      icon={<FolderOpen size={16} color={colors.text} />} onPress={() => { void manager.openFolder() }} testID="open-local-vault" />
    <Text style={styles.detail}>{mobileText(optionalNativeWorkspaceAccessModule()?.syncLinkedWorkspace ? 'mobile.vaults.folderOpenHint' : 'mobile.vaults.localCopy')}</Text>
    {removing && <View style={styles.section} testID="forget-vault-confirmation">
      <Text style={styles.detail}>{mobileText('status.vault.removeConfirmMessage').replace('{label}', removing.label)}</Text>
      <View style={styles.row}>
        <MobileButton disabled={manager.busy} label={mobileText('common.cancel')} variant="ghost" onPress={() => setRemoving(null)} />
        <MobileButton disabled={manager.busy} label={mobileText('status.vault.removeConfirmAction')} tone="danger"
          onPress={() => { void manager.forget(removing.id).then(() => setRemoving(null)) }} testID="confirm-forget-vault" />
      </View>
    </View>}
  </View>
}

const rowStyles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  select: { flex: 1, minWidth: 0 },
})
