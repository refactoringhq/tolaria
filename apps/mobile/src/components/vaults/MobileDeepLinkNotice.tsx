import { StyleSheet, View } from 'react-native'
import type { MobileMetrics } from '../../ui/mobileMetrics'
import type { MobileColors } from '../../ui/theme/mobilePalette'
import { useMobileStyles } from '../../ui/theme/useMobileTheme'
import { Text } from '../ui/text'

export function MobileDeepLinkNotice({ message }: { message: string }) {
  const styles = useMobileStyles(createStyles)
  return <View pointerEvents="none" style={styles.position}>
    <Text accessibilityLiveRegion="polite" style={styles.message}>{message}</Text>
  </View>
}

function createStyles(colors: MobileColors, metrics: MobileMetrics) {
  return StyleSheet.create({
    position: {
      position: 'absolute',
      top: 8,
      left: 12,
      right: 12,
      alignItems: 'center',
      zIndex: 30,
    },
    message: {
      maxWidth: 520,
      borderRadius: 8,
      paddingHorizontal: metrics.space.md,
      paddingVertical: metrics.space.sm,
      color: colors.textInverse,
      backgroundColor: colors.primary,
      overflow: 'hidden',
      textAlign: 'center',
    },
  })
}
