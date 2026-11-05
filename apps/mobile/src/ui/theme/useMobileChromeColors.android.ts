import { useMaterialColors } from "@expo/ui/jetpack-compose";
import type { MobileChromeColors } from "./mobileChromeColorTypes";

export function useMobileChromeColors(): MobileChromeColors {
	const colors = useMaterialColors();
	return {
		background: colors.background,
		surface: colors.surfaceContainer,
		text: colors.onBackground,
		muted: colors.onSurfaceVariant,
		border: colors.outlineVariant,
		accent: colors.primary,
		danger: colors.error,
	};
}
