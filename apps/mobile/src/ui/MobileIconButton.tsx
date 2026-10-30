import type { ReactNode } from 'react'
import { StyleSheet } from 'react-native'
import { Button } from '../components/ui/button'
import { cn } from '../components/ui/utils'
import { useMobileStyles } from './theme/useMobileTheme'
import type { MobileColors } from './theme/mobilePalette'
import type { MobileMetrics } from './mobileMetrics'

type MobileIconButtonDensity = 'default' | 'leading' | 'toolbar'

export function MobileIconButton({
  accessibilityLabel,
  children,
  density = 'toolbar',
  onPress,
  selected = false,
  testID,
}: {
  accessibilityLabel: string
  children: ReactNode
  density?: MobileIconButtonDensity
  onPress?: () => void
  selected?: boolean
  testID?: string
}) {
  const { styles, hitSlop } = useMobileStyles(createIconButtonStyles)
  return (
    <Button
      accessibilityLabel={accessibilityLabel}
      className={cn('active:opacity-70', selected ? 'bg-accent' : 'bg-transparent')}
      hitSlop={hitSlop}
      onPress={onPress}
      size="icon"
      style={StyleSheet.flatten(styles[density])}
      testID={testID}
      variant={selected ? 'secondary' : 'ghost'}
    >
      {children}
    </Button>
  )
}

function createIconButtonStyles(_colors: MobileColors, metrics: MobileMetrics) {
  const desktopToolbarActionParity = metrics.toolbarAction
  const compactButton = {
    alignItems: 'center' as const,
    flexDirection: 'row' as const,
    width: metrics.size(36),
    height: metrics.size(36),
  }
  const styles = StyleSheet.create({
  default: {
    ...compactButton,
    justifyContent: 'center',
    borderRadius: 6,
  },
  leading: {
    ...compactButton,
    justifyContent: 'flex-start',
    borderRadius: 6,
  },
  toolbar: {
    alignItems: 'center',
    justifyContent: 'center',
    width: desktopToolbarActionParity.iconButtonSize,
    height: desktopToolbarActionParity.iconButtonSize,
    borderRadius: desktopToolbarActionParity.borderRadius,
    flexDirection: 'row',
  },
  })
  return { styles, hitSlop: desktopToolbarActionParity.hitSlop }
}
