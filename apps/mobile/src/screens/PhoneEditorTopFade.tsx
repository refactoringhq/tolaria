import { StyleSheet, useWindowDimensions } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg'
import { useMobileColors } from '../ui/theme/useMobileTheme'

export function PhoneEditorTopFade() {
  const colors = useMobileColors()
  const insets = useSafeAreaInsets()
  const { width } = useWindowDimensions()
  const height = insets.top + 72

  return (
    <Svg height={height} pointerEvents="none" style={StyleSheet.absoluteFill} width={width}>
      <Defs>
        <LinearGradient id="phone-editor-top-fade" x1="0" x2="0" y1="0" y2="1">
          <Stop offset="0" stopColor={colors.editor} stopOpacity="0.86" />
          <Stop offset="1" stopColor={colors.editor} stopOpacity="0" />
        </LinearGradient>
      </Defs>
      <Rect fill="url(#phone-editor-top-fade)" height={height} width={width} />
    </Svg>
  )
}
