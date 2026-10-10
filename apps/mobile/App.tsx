import './global.css'
import { StatusBar } from 'expo-status-bar'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context'
import { MobileUiLab } from './src/screens/MobileUiLab'
import { mobileColors } from './src/ui/tokens'
import { useNativeGitProbe } from './src/qa/nativeGitProbe'

export function App() {
  useNativeGitProbe()
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <SafeAreaView style={{ backgroundColor: mobileColors.app, flex: 1 }}>
          <StatusBar style="dark" />
          <MobileUiLab />
        </SafeAreaView>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  )
}
