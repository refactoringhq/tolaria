import { PlatformColor } from "react-native";
import type { MobileChromeColors } from "./mobileChromeColorTypes";

export function useMobileChromeColors(): MobileChromeColors {
	return {
		background: PlatformColor("systemBackground"),
		surface: PlatformColor("secondarySystemBackground"),
		text: PlatformColor("label"),
		muted: PlatformColor("secondaryLabel"),
		border: PlatformColor("separator"),
		accent: PlatformColor("systemBlue"),
		danger: PlatformColor("systemRed"),
	};
}
