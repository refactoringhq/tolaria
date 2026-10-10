import { StyleSheet, View } from 'react-native'
import { FolderOpen } from 'phosphor-react-native'
import { Text } from '../ui/text'
import { mobileText } from '../../i18n/mobileText'
import { MobileButton } from '../../ui/MobileButton'
import { mobileColors } from '../../ui/tokens'

export function MobileWorkspaceLoadFailure({ onManage }: { onManage: () => void }) {
  return <View style={styles.root} testID="workspace-load-failure">
    <Text accessibilityRole="alert" style={styles.message}>{mobileText('mobile.vaults.requestFailed')}</Text>
    <MobileButton label={mobileText('status.vault.manageWorkspaces')} onPress={onManage}
      icon={<FolderOpen size={16} color={mobileColors.text} />} />
  </View>
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24, gap: 16, backgroundColor: mobileColors.app },
  message: { color: mobileColors.textMuted, fontSize: 14, lineHeight: 20, maxWidth: 440, textAlign: 'center' },
})
