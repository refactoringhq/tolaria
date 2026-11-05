import { useMobileColors } from "./useMobileTheme";
import type { MobileChromeColors } from "./mobileChromeColorTypes";

export function useMobileChromeColors(): MobileChromeColors {
	const colors = useMobileColors();
	return {
		background: colors.app,
		surface: colors.popover,
		text: colors.text,
		muted: colors.textMuted,
		border: colors.borderStrong,
		accent: colors.primary,
		danger: colors.danger,
	};
}
