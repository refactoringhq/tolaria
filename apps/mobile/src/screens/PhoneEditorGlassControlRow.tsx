import MenuView from '@expo/ui/community/menu'
import { GlassView } from 'expo-glass-effect'
import { SymbolView } from 'expo-symbols'
import { useCallback, useMemo, useState } from 'react'
import { Keyboard, Pressable, StyleSheet, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { showNativeConfirmation } from '../components/ui/mobileNativeDialogs'
import { Text } from '../components/ui/text'
import { mobileText } from '../i18n/mobileText'
import { useMobileColors, useMobileMetrics } from '../ui/theme/useMobileTheme'
import { phoneEditorMenuActions, runPhoneEditorMenuAction } from './phoneEditorMenuActions'

export type PhoneEditorGlassChromeProps = {
  favorite: boolean
  noteTitle: string
  rawMode: boolean
  titleVisible: boolean
  onBack: () => void
  onDeleteNote: () => void
  onExportPdf: () => void
  onFind: () => void
  onMove: () => void
  onOpenProperties: () => void
  onRename: () => void
  onToggleFavorite: () => void
  onToggleSourceMode: () => void
  onTitlePress: () => void
}

export function PhoneEditorGlassControlRow(props: PhoneEditorGlassChromeProps) {
  const colors = useMobileColors()
  const metrics = useMobileMetrics()
  const insets = useSafeAreaInsets()
  const [rawMode, setRawMode] = useState(props.rawMode)
  const actions = useMemo(() => phoneEditorMenuActions(props.favorite, rawMode), [props.favorite, rawMode])
  const dispatch = useCallback((id: string) => {
    Keyboard.dismiss()
    runPhoneEditorMenuAction(id, {
      favorite: props.onToggleFavorite,
      toggleSourceMode: () => { props.onToggleSourceMode(); setRawMode((current) => !current) },
      openProperties: props.onOpenProperties,
      rename: props.onRename,
      move: props.onMove,
      find: props.onFind,
      exportPdf: props.onExportPdf,
      delete: () => showNativeConfirmation({
        cancelLabel: mobileText('common.cancel'),
        confirmLabel: mobileText('command.note.deleteNote'),
        message: props.noteTitle,
        onConfirm: props.onDeleteNote,
        title: mobileText('command.note.deleteNote'),
      }),
    })
  }, [props])

  return (
    <View
      pointerEvents="box-none"
      style={[styles.row, { left: metrics.phoneChrome.rowHorizontalPadding, right: metrics.phoneChrome.rowHorizontalPadding, top: insets.top + metrics.space.sm }]}
    >
      <GlassView glassEffectStyle="regular" isInteractive style={styles.backGlass}>
        <Pressable accessibilityLabel={mobileText('command.navigation.goBack')} accessibilityRole="button" onPress={props.onBack} style={styles.backButton} testID="phone-editor-back">
          <SymbolView fallback={<Text style={{ color: colors.text }}>‹</Text>} name={{ ios: 'chevron.backward', android: 'arrow_back' }} size={19} tintColor={colors.text} />
          <Text style={[styles.backLabel, { color: colors.text }]}>{mobileText('command.navigation.goBack')}</Text>
        </Pressable>
      </GlassView>
      <MenuView actions={actions} onPressAction={({ nativeEvent }) => dispatch(nativeEvent.event)} testID="phone-editor-menu">
        <GlassView glassEffectStyle="regular" isInteractive style={styles.menuGlass}>
          <Pressable accessibilityLabel={mobileText('editor.toolbar.moreActions')} accessibilityRole="button" style={styles.menuButton} testID="phone-editor-menu-trigger">
            <SymbolView fallback={<Text style={{ color: colors.text }}>•••</Text>} name={{ ios: 'ellipsis', android: 'more_vert' }} size={21} tintColor={colors.text} />
          </Pressable>
        </GlassView>
      </MenuView>
    </View>
  )
}

const styles = StyleSheet.create({
  row: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', position: 'absolute', zIndex: 20 },
  backGlass: { borderRadius: 24, overflow: 'hidden' },
  backButton: { alignItems: 'center', flexDirection: 'row', gap: 8, minHeight: 44, paddingHorizontal: 14 },
  backLabel: { fontSize: 15, fontWeight: '500' },
  menuGlass: { borderRadius: 24, overflow: 'hidden' },
  menuButton: { alignItems: 'center', height: 44, justifyContent: 'center', width: 44 },
})
