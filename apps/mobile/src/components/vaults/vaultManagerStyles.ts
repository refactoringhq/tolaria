import { StyleSheet } from 'react-native'
import { mobileColors, mobileSpace } from '../../ui/tokens'

export const vaultManagerStyles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: '#00000040', justifyContent: 'center', alignItems: 'center', padding: mobileSpace.lg },
  panel: { width: '100%', maxWidth: 560, maxHeight: '90%', borderRadius: 8, overflow: 'hidden' },
  content: { padding: mobileSpace.lg, gap: mobileSpace.lg },
  section: { gap: mobileSpace.sm },
  row: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: mobileSpace.sm },
  label: { fontSize: 13, fontWeight: '500', color: mobileColors.text },
  detail: { fontSize: 12, lineHeight: 18, color: mobileColors.textMuted },
  error: { fontSize: 12, lineHeight: 18, color: mobileColors.danger },
  code: { fontSize: 24, fontWeight: '600', color: mobileColors.text, textAlign: 'center', paddingVertical: mobileSpace.sm },
  vault: { alignItems: 'flex-start', minHeight: 44 },
  progress: { gap: mobileSpace.sm, flexDirection: 'row', alignItems: 'center' },
})
