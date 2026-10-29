import { useMobileColors, useMobileStyles } from '../../ui/theme/useMobileTheme'
import { useState } from 'react'
import { ActivityIndicator, Keyboard, View } from 'react-native'
import { CloudArrowDown } from 'phosphor-react-native'
import { Text } from '../ui/text'
import { mobileText } from '../../i18n/mobileText'
import { MobileButton } from '../../ui/MobileButton'
import { MobileTextInput } from '../../ui/MobileTextInput'

import type { useMobileVaults } from '../../workspace/git/useMobileVaults'
import { githubRepositoryUrl } from '../../workspace/git/githubRepositoryUrl'
import { MobileGitHubAccount } from './MobileGitHubAccount'
import { MobileGitControls } from './MobileGitControls'
import { createVaultManagerStyles } from './vaultManagerStyles'
import { MobileSavedVaults } from './MobileSavedVaults'
import { MobileConflictReview } from './MobileConflictReview'
import { MobileCloneProgress } from './MobileCloneProgress'
import { gitCloneProgressLabel } from '../../workspace/git/gitCloneProgressLabel'

type VaultManager = ReturnType<typeof useMobileVaults>

export function MobileVaultManager({ manager }: { manager: VaultManager }) {
  const styles = useMobileStyles(createVaultManagerStyles)
  return <View testID="vault-manager">
        <MobileCloneProgress clone={manager.cloneProgress} />
        <VaultBusyProgress manager={manager} />
        {manager.conflictReview ? <MobileConflictReview key={manager.conflictReview.value.files.map(file => file.path).join('|')}
          files={manager.conflictReview.value.files} busy={manager.busy} failure={manager.conflictFailure}
          cancel={manager.cancelConflictReview} apply={choices => { void manager.resolveConflicts(choices) }} /> : <View style={styles.settingsContent}>
          <VaultOperationStatus manager={manager} />
          <ReviewConflictsButton manager={manager} />
          <MobileGitControls manager={manager} />
          {manager.linked && <View style={styles.section}>
            <Text style={styles.detail}>{mobileText('mobile.vaults.folderLinked')}</Text>
            <MobileButton disabled={manager.busy} label={mobileText('mobile.sync.action')} onPress={() => { void manager.sync() }} testID="linked-folder-sync" />
          </View>}
          <MobileSavedVaults manager={manager} />
          <MobileGitHubAccount account={manager.account} disabled={manager.busy} clone={manager.clone} />
          <CloneRepository manager={manager} />
        </View>}
  </View>
}

function ReviewConflictsButton({ manager }: { manager: VaultManager }) {
  if (manager.status !== 'diverged') return null
  return <MobileButton disabled={manager.busy} label={mobileText('mobile.sync.review')}
    onPress={() => { void manager.reviewConflicts() }} style={{ minHeight: 44 }} testID="review-sync-conflicts" />
}

function CloneRepository({ manager }: { manager: VaultManager }) {
  const styles = useMobileStyles(createVaultManagerStyles)
  const mobileColors = useMobileColors()
  const [url, setUrl] = useState('')
  return <View style={styles.section}>
    <MobileTextInput label={mobileText('mobile.vaults.repositoryUrl')} value={url} onChangeText={setUrl} editable={!manager.busy} autoCorrect={false} keyboardType="url" testID="git-repository-url" />
    <MobileButton label={mobileText('mobile.vaults.clone')} disabled={manager.busy || !validRepository(url)} icon={<CloudArrowDown size={16} color={mobileColors.textInverse} />} variant="primary" onPress={() => { Keyboard.dismiss(); void manager.clone(url.trim()) }} testID="clone-git-vault" />
  </View>
}

function validRepository(url: string) {
  try { githubRepositoryUrl(url.trim()); return true } catch { return false }
}

function VaultOperationStatus({ manager }: { manager: VaultManager }) {
  const styles = useMobileStyles(createVaultManagerStyles)
  if (!hasVaultProblem(manager)) return null
  return <View style={styles.section} accessibilityLiveRegion="polite">
    {manager.error && <Text accessibilityRole="alert" style={styles.error}>{operationErrorMessage(manager.error)}</Text>}
    {manager.catalog.error === 'catalog' && <Text style={styles.error}>{mobileText('mobile.vaults.catalogFailed')}</Text>}
    {manager.catalog.error && <MobileButton disabled={manager.busy} label={mobileText('pulse.retry')} onPress={manager.catalog.retry} testID="vault-restore-retry" />}
    {manager.status === 'diverged' && manager.active.git && <Text style={styles.error}>{mobileText('mobile.vaults.diverged')}</Text>}
    {manager.status === 'saveFailed' && <MobileButton disabled={manager.busy} label={mobileText('pulse.retry')} onPress={() => { void manager.sync() }} testID="vault-manager-retry" />}
  </View>
}

function operationErrorMessage(error: NonNullable<VaultManager['error']>) {
  if (typeof error === 'string') return mobileText(error)
  return mobileText('mobile.vaults.checkoutWriteFailed').replace('{path}', error.path)
}

function hasVaultProblem(manager: VaultManager) {
  return Boolean(manager.error || manager.catalog.error || ['diverged', 'saveFailed'].includes(manager.status))
}

function VaultBusyProgress({ manager }: { manager: VaultManager }) {
  const styles = useMobileStyles(createVaultManagerStyles)
  const colors = useMobileColors()
  if (!manager.busy || manager.cloneProgress.running) return null
  const progress = gitCloneProgressLabel({ progress: manager.syncProgress.progress })
  return <View style={[styles.content, styles.progress]} accessibilityLiveRegion="polite"
    accessibilityRole="progressbar" accessibilityValue={progress.value}>
    <ActivityIndicator color={colors.primary} />
    <View style={{ flex: 1 }}>
      <Text style={styles.detail}>{progressLabel(manager.phase)}</Text>
      {progress.count && <Text style={styles.detail} testID="git-sync-progress-count">{progress.count}</Text>}
    </View>
  </View>
}

function progressLabel(phase: VaultManager['phase']) {
  if (!phase) return mobileText('mobile.vaults.saving')
  if (phase === 'clone') return mobileText('mobile.vaults.cloning')
  return mobileText(`mobile.vaults.${phase}`)
}
