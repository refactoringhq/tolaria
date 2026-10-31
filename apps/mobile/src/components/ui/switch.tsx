import type { ComponentProps } from 'react'
import { Switch as NativeSwitch, type StyleProp, type ViewStyle } from 'react-native'
import { useMobileColors } from '../../ui/theme/useMobileTheme'

type SwitchProps = Omit<ComponentProps<typeof NativeSwitch>, 'value' | 'onValueChange' | 'style'> & {
  checked: boolean
  onCheckedChange?: (checked: boolean) => void
  style?: StyleProp<ViewStyle>
}

export function Switch({ checked, disabled, onCheckedChange, style, ...props }: SwitchProps) {
  const mobileColors = useMobileColors()
  return <NativeSwitch
    {...props}
    disabled={disabled}
    hitSlop={8}
    ios_backgroundColor={mobileColors.borderStrong}
    onValueChange={onCheckedChange}
    style={style}
    thumbColor={mobileColors.textInverse}
    trackColor={{ false: mobileColors.borderStrong, true: mobileColors.primary }}
    value={checked}
  />
}
