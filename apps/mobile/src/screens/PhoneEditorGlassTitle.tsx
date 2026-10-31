import { GlassView } from 'expo-glass-effect'
import { useEffect, useState } from 'react'
import { Animated, Keyboard, Pressable, StyleSheet } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Text } from '../components/ui/text'
import { useMobileColors, useMobileMetrics } from '../ui/theme/useMobileTheme'

type Props = { noteTitle: string; onPress: () => void; visible: boolean }

export function PhoneEditorGlassTitle(props: Props) {
  const colors = useMobileColors()
  const metrics = useMobileMetrics()
  const insets = useSafeAreaInsets()
  const [keyboardVisible, setKeyboardVisible] = useState(false)
  const [opacity] = useState(() => new Animated.Value(0))
  useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', () => setKeyboardVisible(true))
    const hide = Keyboard.addListener('keyboardDidHide', () => setKeyboardVisible(false))
    return () => { show.remove(); hide.remove() }
  }, [])
  useEffect(() => {
    Animated.timing(opacity, { toValue: props.visible && !keyboardVisible ? 1 : 0, duration: 180, useNativeDriver: true }).start()
  }, [keyboardVisible, opacity, props.visible])

  return (
    <Animated.View
      pointerEvents={props.visible && !keyboardVisible ? 'auto' : 'none'}
      style={[styles.position, { opacity, top: insets.top + metrics.space.sm }]}
    >
      <GlassView glassEffectStyle="regular" isInteractive style={styles.glass}>
        <Pressable accessibilityRole="button" accessibilityLabel={props.noteTitle} onPress={props.onPress} style={styles.button}>
          <Text numberOfLines={1} style={[styles.text, { color: colors.text }]}>{props.noteTitle}</Text>
        </Pressable>
      </GlassView>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  position: { alignSelf: 'center', maxWidth: '56%', position: 'absolute', zIndex: 19 },
  glass: { borderRadius: 20, overflow: 'hidden' },
  button: { alignItems: 'center', justifyContent: 'center', minHeight: 40, paddingHorizontal: 14 },
  text: { fontSize: 15, fontWeight: '600' },
})
