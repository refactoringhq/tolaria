import { useCallback, useContext, useRef, useState } from 'react'
import { RefreshControl } from 'react-native'
import { MobileVaultControlsContext } from './MobileVaultContext'
import { emitMobileHaptic } from '../ui/mobileHaptics'
import { mobilePullToSyncProps } from './mobilePullToSync'

export function useMobilePullToSync() {
  const controls = useContext(MobileVaultControlsContext)
  const [refreshing, setRefreshing] = useState(false)
  const refreshingRef = useRef(false)
  const props = mobilePullToSyncProps(controls, refreshing)
  const finishRefresh = useCallback(() => {
    refreshingRef.current = false
    setRefreshing(false)
  }, [])
  const onRefresh = useCallback(() => {
    if (!props || refreshingRef.current) return
    const operation = props.onRefresh()
    if (!operation) return
    emitMobileHaptic('selection')
    refreshingRef.current = true
    setRefreshing(true)
    void operation.then(
      () => finishRefresh(),
      () => finishRefresh(),
    )
  }, [finishRefresh, props])

  return props ? <RefreshControl refreshing={refreshing} onRefresh={onRefresh} /> : undefined
}
