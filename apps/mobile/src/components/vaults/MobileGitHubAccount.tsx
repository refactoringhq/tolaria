import { ArrowSquareOut, GithubLogo, SignOut } from 'phosphor-react-native'
import { Linking, View } from 'react-native'
import { mobileText } from '../../i18n/mobileText'
import { MobileButton } from '../../ui/MobileButton'
import { useMobileColors, useMobileStyles } from '../../ui/theme/useMobileTheme'
import type { useGitHubAccount } from '../../workspace/git/useGitHubAccount'
import { showNativeConfirmation } from '../ui/mobileNativeDialogs'
import { Text } from '../ui/text'
import { MobileDeviceCode } from './MobileDeviceCode'
import { MobileGitHubRepositories } from './MobileGitHubRepositories'
import { createVaultManagerStyles } from './vaultManagerStyles'

type GitHubAccountProps = { account: ReturnType<typeof useGitHubAccount>; disabled: boolean; clone: (url: string) => Promise<void> }

export function MobileGitHubAccount({ account, disabled, clone }: GitHubAccountProps) {
  const styles = useMobileStyles(createVaultManagerStyles)
  const mobileColors = useMobileColors()
  const locked = disabled || account.busy
  return <View style={styles.section}>
    <Text style={styles.label}>{mobileText('mobile.vaults.github')}</Text>
    {!account.configured && <Text style={styles.detail}>{mobileText('mobile.vaults.notConfigured')}</Text>}
    {account.error && <Text accessibilityRole="alert" style={styles.error}>{mobileText(account.error)}</Text>}
    {account.session ? <>
      <Text style={styles.detail}>{mobileText('mobile.vaults.connectedAs').replace('{login}', account.session.login)}</Text>
      <View style={styles.row}>
        <MobileGitHubRepositories account={account} clone={clone} disabled={locked} />
        <MobileButton disabled={locked} label={mobileText('mobile.vaults.signOut')} icon={<SignOut size={16} color={mobileColors.textMuted} />} onPress={() => showNativeConfirmation({
          cancelLabel: mobileText('common.cancel'),
          confirmLabel: mobileText('mobile.vaults.signOut'),
          message: mobileText('mobile.vaults.connectedAs').replace('{login}', account.session?.login ?? ''),
          onConfirm: () => { void account.signOut() },
          title: mobileText('mobile.vaults.signOut'),
        })} variant="ghost" />
      </View>
    </> : <MobileButton disabled={locked || !account.configured} label={mobileText('mobile.vaults.signIn')} icon={<GithubLogo size={16} color={mobileColors.text} />} onPress={() => { void account.signIn() }} />}
    {account.code && <View style={styles.section}>
      <Text style={styles.detail}>{mobileText('mobile.vaults.deviceCode')}</Text>
      <MobileDeviceCode key={account.code.user_code} code={account.code.user_code} />
      <View style={styles.row}>
        <MobileButton label={mobileText('mobile.vaults.openGitHub')} icon={<ArrowSquareOut size={16} color={mobileColors.text} />} onPress={() => { void Linking.openURL('https://github.com/login/device').catch(account.cancelSignIn) }} />
        <MobileButton label={mobileText('common.cancel')} variant="ghost" onPress={account.cancelSignIn} />
      </View>
    </View>}
  </View>
}
