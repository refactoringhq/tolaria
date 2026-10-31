import { StyleSheet, View } from 'react-native'
import { type PhoneEditorGlassChromeProps, PhoneEditorGlassControlRow } from './PhoneEditorGlassControlRow'
import { PhoneEditorGlassTitle } from './PhoneEditorGlassTitle'
import { PhoneEditorTopFade } from './PhoneEditorTopFade'

export function PhoneEditorGlassChrome(props: PhoneEditorGlassChromeProps) {
  return (
    <View pointerEvents="box-none" style={StyleSheet.absoluteFill} testID="phone-editor-glass-chrome">
      <PhoneEditorTopFade />
      <PhoneEditorGlassTitle noteTitle={props.noteTitle} onPress={props.onTitlePress} visible={props.titleVisible} />
      <PhoneEditorGlassControlRow {...props} />
    </View>
  )
}
