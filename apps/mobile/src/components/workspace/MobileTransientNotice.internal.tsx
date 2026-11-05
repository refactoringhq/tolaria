import { useEffect } from 'react'
import { AccessibilityInfo, StyleSheet, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import type { MobileMetrics } from '../../ui/mobileMetrics'
import type { MobileColors } from '../../ui/theme/mobilePalette'
import { useMobileStyles } from '../../ui/theme/useMobileTheme'
import { Text } from '../ui/text'

export function MobileTransientNotice({
	message,
	onDismiss,
}: {
	message: string | null
	onDismiss: () => void
}) {
	const { top } = useSafeAreaInsets()
	const styles = useMobileStyles(createStyles)
	useEffect(() => {
		if (!message) return
		AccessibilityInfo.announceForAccessibility(message)
		const timeout = setTimeout(onDismiss, 2400)
		return () => clearTimeout(timeout)
	}, [message, onDismiss])
	if (!message) return null
	return (
		<View pointerEvents="none" style={[styles.position, { top: top + 8 }]}>
			<Text accessibilityLiveRegion="polite" style={styles.message} testID="mobile-transient-notice">
				{message}
			</Text>
		</View>
	)
}

function createStyles(colors: MobileColors, metrics: MobileMetrics) {
	return StyleSheet.create({
		position: {
			position: 'absolute',
			left: 12,
			right: 12,
			zIndex: 20,
			alignItems: 'center',
	},
		message: {
			maxWidth: 520,
			paddingHorizontal: metrics.size(16),
			paddingVertical: metrics.size(12),
			borderRadius: 8,
			borderWidth: 1,
			borderColor: colors.borderStrong,
			backgroundColor: colors.popover,
			color: colors.text,
			fontSize: metrics.size(14),
		},
	})
}
