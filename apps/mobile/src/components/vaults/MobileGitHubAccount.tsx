import { Linking, View } from 'react-native'
import { ArrowSquareOut, GithubLogo, SignOut } from 'phosphor-react-native'
import { Text } from '../ui/text'
import { mobileText } from '../../i18n/mobileText'
import { MobileButton } from '../../ui/MobileButton'
import { mobileColors } from '../../ui/tokens'
import type { useGitHubAccount } from '../../workspace/git/useGitHubAccount'
import { vaultManagerStyles as styles } from './vaultManagerStyles'

type GitHubAccountProps = { account: ReturnType<typeof useGitHubAccount>; disabled: boolean; clone: (url: string) => Promise<void> }

export function MobileGitHubAccount({ account, disabled, clone }: GitHubAccountProps) {
  const locked = disabled || account.busy
  return <View style={styles.section}>
    <Text style={styles.label}>{mobileText('mobile.vaults.github')}</Text>
    {!account.configured && <Text style={styles.detail}>{mobileText('mobile.vaults.notConfigured')}</Text>}
    {account.error && <Text accessibilityRole="alert" style={styles.error}>{mobileText('mobile.vaults.authFailed')}</Text>}
    {account.session ? <>
      <Text style={styles.detail}>{mobileText('mobile.vaults.connectedAs').replace('{login}', account.session.login)}</Text>
      <View style={styles.row}>
        <MobileButton disabled={locked} label={mobileText('mobile.vaults.loadRepositories')} icon={<GithubLogo size={16} color={mobileColors.text} />} onPress={() => { void account.loadRepositories() }} />
        <MobileButton disabled={locked} label={mobileText('mobile.vaults.signOut')} icon={<SignOut size={16} color={mobileColors.textMuted} />} onPress={() => { void account.signOut() }} variant="ghost" />
      </View>
    </> : <MobileButton disabled={locked || !account.configured} label={mobileText('mobile.vaults.signIn')} icon={<GithubLogo size={16} color={mobileColors.text} />} onPress={() => { void account.signIn() }} />}
    {account.code && <View style={styles.section}>
      <Text style={styles.detail}>{mobileText('mobile.vaults.deviceCode')}</Text>
      <Text selectable style={styles.code}>{account.code.user_code}</Text>
      <View style={styles.row}>
        <MobileButton label={mobileText('mobile.vaults.openGitHub')} icon={<ArrowSquareOut size={16} color={mobileColors.text} />} onPress={() => { void Linking.openURL('https://github.com/login/device').catch(account.cancelSignIn) }} />
        <MobileButton label={mobileText('common.cancel')} variant="ghost" onPress={account.cancelSignIn} />
      </View>
    </View>}
    <GitHubRepositories account={account} clone={clone} disabled={locked} />
  </View>
}

function GitHubRepositories({ account, clone, disabled }: GitHubAccountProps) {
  if (!account.repositories.length) return null
  return <View style={styles.section}>
    <Text style={styles.label}>{mobileText('mobile.vaults.repositories')}</Text>
    {account.repositories.map((repo) => <MobileButton key={repo.id} disabled={disabled} label={repo.full_name} style={styles.vault} variant="ghost" onPress={() => { void clone(repo.clone_url) }} />)}
    {account.hasMore && <MobileButton disabled={disabled} label={mobileText('mobile.vaults.more')} onPress={() => { void account.loadRepositories(true) }} />}
  </View>
}
