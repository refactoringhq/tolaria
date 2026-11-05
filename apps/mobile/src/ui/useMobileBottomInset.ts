import { useEffect, useState } from 'react'
import { Keyboard, type KeyboardEvent, Platform } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

/** Bottom controls own home-indicator clearance, not the full-height pane. */
export function useMobileBottomInset() {
  return useMobileKeyboardInset().bottom
}

export function useMobileKeyboardInset() {
  const { bottom } = useSafeAreaInsets()
  const [keyboardVisible, setKeyboardVisible] = useState(() => Keyboard.isVisible())
  useEffect(() => {
    const showWithAnimation = (event: KeyboardEvent) => {
      Keyboard.scheduleLayoutAnimation(event)
      setKeyboardVisible(true)
    }
    const hideWithAnimation = (event: KeyboardEvent) => {
      Keyboard.scheduleLayoutAnimation(event)
      setKeyboardVisible(false)
    }
    const show = () => setKeyboardVisible(true)
    const hide = () => setKeyboardVisible(false)
    const events = Platform.OS === 'ios'
      ? [Keyboard.addListener('keyboardWillShow', showWithAnimation), Keyboard.addListener('keyboardWillHide', hideWithAnimation)]
      : [Keyboard.addListener('keyboardDidShow', show), Keyboard.addListener('keyboardDidHide', hide)]
    return () => { for (const event of events) event.remove() }
  }, [])
  return { bottom: keyboardVisible ? 0 : bottom, keyboardVisible }
}
