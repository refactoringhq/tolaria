import { KeyboardAvoidingView, Modal, Platform, ScrollView, StyleSheet } from 'react-native'
import { Text } from '../components/ui/text'
import { MobileVaultManager } from '../components/vaults/MobileVaultManager'
import { mobileText } from '../i18n/mobileText'
import { MobileButton } from '../ui/MobileButton'
import { MobilePanel, MobileToolbar, MobileToolbarSpacer, MobileToolbarTitle } from '../ui/MobilePanel'
import type { MobileMetrics } from '../ui/mobileMetrics'
import { mobileSheetPresentation } from '../ui/mobileSheetPresentation'
import type { MobileColors } from '../ui/theme/mobilePalette'
import { useMobileStyles } from '../ui/theme/useMobileTheme'
import type { useMobileVaults } from '../workspace/git/useMobileVaults'
import { useMobileModalDismiss } from '../workspace/useMobileModalDismiss'
import { MobileAppearanceSettings } from './MobileAppearanceSettings'
import { MobilePrivacySettings } from './MobilePrivacySettings'
import { MobileUpdateSettings } from './MobileUpdateSettings'
import { useMobileSettings } from './useMobileSettings'
import { useMobileUpdateChannel } from './useMobileUpdateChannel'

export function MobileSettingsSheet({ manager }: { manager: ReturnType<typeof useMobileVaults> }) {
  const { styles } = useMobileStyles(createThemeStyles)
  const preferences = useMobileSettings()
  const updates = useMobileUpdateChannel(manager)
  const close = () => { if (manager.busy) return; manager.close(); preferences.close() }
  const opened = preferences.opened || manager.opened
  useMobileModalDismiss(close, opened)
  return <Modal visible={opened} {...mobileSheetPresentation(Platform.OS)} onRequestClose={close}
    supportedOrientations={['portrait', 'portrait-upside-down', 'landscape-left', 'landscape-right']}>
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={Platform.OS === 'ios' ? styles.sheetRoot : styles.backdrop}>
      <MobilePanel style={Platform.OS === 'ios' ? styles.sheetPanel : styles.panel} accessibilityViewIsModal testID="mobile-settings">
        <MobileToolbar>
          <MobileToolbarTitle title={mobileText('settings.title')} />
          <MobileToolbarSpacer />
          <MobileButton density="compact" label={mobileText('common.done')} onPress={close} testID="settings-done" variant="ghost" />
        </MobileToolbar>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <SettingsSheetContent manager={manager} preferences={preferences} updates={updates} />
        </ScrollView>
      </MobilePanel>
    </KeyboardAvoidingView>
  </Modal>
}

function SettingsSheetContent({
  manager,
  preferences,
  updates,
}: {
  manager: ReturnType<typeof useMobileVaults>
  preferences: ReturnType<typeof useMobileSettings>
  updates: ReturnType<typeof useMobileUpdateChannel>
}) {
  const { styles } = useMobileStyles(createThemeStyles)
  return <>
    {preferences.error && <Text accessibilityRole="alert" style={styles.error}>{mobileText(preferences.error === 'load' ? 'mobile.settings.loadFailed' : 'mobile.settings.saveFailed')}</Text>}
    {preferences.error === 'load' && <MobileButton label={mobileText('pulse.retry')} onPress={() => { void preferences.retry() }} />}
    <MobileVaultManager manager={manager} />
    {!manager.conflictReview && <>
      <MobileAppearanceSettings />
      <MobileUpdateSettings updates={updates} />
      <MobilePrivacySettings />
    </>}
  </>
}

function createThemeStyles(mobileColors: MobileColors, metrics: MobileMetrics) {
  const { space: mobileSpace } = metrics
  const styles = StyleSheet.create({
    backdrop: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: mobileColors.overlay, padding: mobileSpace.lg },
    panel: { width: '100%', maxWidth: 540, maxHeight: '85%', borderRadius: 8, overflow: 'hidden', backgroundColor: mobileColors.dialog },
    sheetRoot: { flex: 1, backgroundColor: mobileColors.dialog },
    sheetPanel: { flex: 1, width: '100%', maxWidth: '100%', maxHeight: '100%', borderRadius: 0, overflow: 'hidden', backgroundColor: mobileColors.dialog },
    content: { padding: metrics.size(20), gap: metrics.size(20) },
    error: { fontSize: metrics.size(12), lineHeight: metrics.size(18), color: mobileColors.danger },
  })
  return { mobileColors, styles }
}
