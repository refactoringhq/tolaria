import { useEffect } from 'react'
import { Linking } from 'react-native'

export function useNativeGitProbe() {
  useEffect(() => {
    if (!__DEV__) return
    const run = async (url: string | null) => {
      if (!url) return
      try {
        const endpoint = new URL(url).searchParams.get('gitProbe')
        if (!endpoint || !isLoopbackEndpoint(endpoint)) return
        const recoveryPhase = new URL(url).searchParams.get('writeRecoveryProbe')
        if (recoveryPhase) {
          const { runNativeWriteRecoveryProbe } = await import('./nativeWriteRecoveryProbe')
          await runNativeWriteRecoveryProbe(endpoint, recoveryPhase)
          return
        }
        const { runNativeGitProbe } = await import('./runNativeGitProbe')
        await runNativeGitProbe(endpoint)
      } catch (error) {
        console.warn('[native-git-probe] Unable to run probe', error)
      }
    }
    const subscription = Linking.addEventListener('url', ({ url }) => { void run(url) })
    void Linking.getInitialURL().then(run).catch(() => undefined)
    return () => subscription.remove()
  }, [])
}

function isLoopbackEndpoint(endpoint: string) {
  const url = new URL(endpoint)
  return url.protocol === 'http:' && url.hostname === '127.0.0.1' && url.pathname === '/'
}
