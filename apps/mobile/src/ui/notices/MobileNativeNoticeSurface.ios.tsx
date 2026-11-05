import { GlassView } from "expo-glass-effect";
import type { MobileNativeNoticeSurfaceProps } from "./MobileNativeNoticeSurface";

export function MobileNativeNoticeSurface({ children }: MobileNativeNoticeSurfaceProps) {
	return (
		<GlassView glassEffectStyle="regular" style={{ borderRadius: 12 }}>
			{children}
		</GlassView>
	);
}
