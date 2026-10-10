import { useState } from 'react'
import { ActivityIndicator, KeyboardAvoidingView, Modal, Platform, ScrollView, View } from 'react-native'
import { CloudArrowDown, FolderOpen, X } from 'phosphor-react-native'
import { Text } from '../ui/text'
import { mobileText } from '../../i18n/mobileText'
import { MobileButton } from '../../ui/MobileButton'
import { MobileIconButton } from '../../ui/MobileIconButton'
import { MobilePanel, MobileToolbar, MobileToolbarTitle, MobileToolbarSpacer } from '../../ui/MobilePanel'
import { MobileTextInput } from '../../ui/MobileTextInput'
import { mobileColors } from '../../ui/tokens'
import type { useMobileVaults } from '../../workspace/git/useMobileVaults'
import { githubRepositoryUrl } from '../../workspace/git/githubRepositoryUrl'
import { MobileGitHubAccount } from './MobileGitHubAccount'
import { vaultManagerStyles as styles } from './vaultManagerStyles'

type VaultManager = ReturnType<typeof useMobileVaults>

export function MobileVaultManager({ manager }: { manager: VaultManager }) {
  return <Modal visible={manager.opened} transparent animationType="fade" onRequestClose={manager.close}>
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.backdrop}>
      <MobilePanel style={styles.panel} accessibilityViewIsModal testID="vault-manager">
        <MobileToolbar>
          <MobileToolbarTitle title={mobileText('status.vault.manageWorkspaces')} />
          <MobileToolbarSpacer />
          {!manager.busy && <MobileIconButton accessibilityLabel={mobileText('window.close')} onPress={manager.close}><X size={18} color={mobileColors.textMuted} /></MobileIconButton>}
        </MobileToolbar>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
          <VaultOperationStatus manager={manager} />
          <View style={styles.section}>
            <MobileButton disabled={manager.busy} label={mobileText('status.vault.openLocal')} icon={<FolderOpen size={16} color={mobileColors.text} />} onPress={() => { void manager.openFolder() }} />
            <Text style={styles.detail}>{mobileText('mobile.vaults.localCopy')}</Text>
          </View>
          <SavedVaults manager={manager} />
          <MobileGitHubAccount account={manager.account} disabled={manager.busy} clone={manager.clone} />
          <CloneRepository manager={manager} />
        </ScrollView>
      </MobilePanel>
    </KeyboardAvoidingView>
  </Modal>
}

function CloneRepository({ manager }: { manager: VaultManager }) {
  const [url, setUrl] = useState('')
  return <View style={styles.section}>
    <MobileTextInput label={mobileText('mobile.vaults.repositoryUrl')} value={url} onChangeText={setUrl} editable={!manager.busy} autoCorrect={false} keyboardType="url" testID="git-repository-url" />
    <MobileButton label={mobileText('mobile.vaults.clone')} disabled={manager.busy || !validRepository(url)} icon={<CloudArrowDown size={16} color={mobileColors.textInverse} />} variant="primary" onPress={() => { void manager.clone(url.trim()) }} testID="clone-git-vault" />
  </View>
}

function validRepository(url: string) {
  try { githubRepositoryUrl(url.trim()); return true } catch { return false }
}

function SavedVaults({ manager }: { manager: VaultManager }) {
  if (!manager.catalog.vaults.length) return null
  return <View style={styles.section}>
    <Text style={styles.label}>{mobileText('status.vault.availableHeader')}</Text>
    {manager.catalog.vaults.map((vault) => <MobileButton key={vault.id} disabled={manager.busy} label={vault.label} style={styles.vault} variant={manager.active.git?.id === vault.id ? 'secondary' : 'ghost'} onPress={() => { void manager.select(vault) }} />)}
  </View>
}

function VaultOperationStatus({ manager }: { manager: VaultManager }) {
  return <View style={styles.section} accessibilityLiveRegion="polite">
    {manager.busy && <View style={styles.progress}><ActivityIndicator color={mobileColors.primary} /><Text style={styles.detail}>{progressLabel(manager.phase)}</Text></View>}
    {manager.error && <Text style={styles.error}>{mobileText('mobile.vaults.requestFailed')}</Text>}
    {manager.catalog.error && <Text style={styles.error}>{mobileText('mobile.vaults.catalogFailed')}</Text>}
    {manager.status === 'diverged' && <Text style={styles.error}>{mobileText('mobile.vaults.diverged')}</Text>}
    {manager.active.git && <MobileButton disabled={manager.busy} label={mobileText('status.sync.now')} onPress={() => { void manager.sync() }} />}
  </View>
}

function progressLabel(phase: VaultManager['phase']) {
  if (!phase) return mobileText('mobile.vaults.saving')
  if (phase === 'clone') return mobileText('mobile.vaults.cloning')
  return mobileText(`mobile.vaults.${phase}`)
}
