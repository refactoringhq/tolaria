import { useEffect } from "react";
import { logNativeMobileCommandPaletteProof } from "../qa/nativeMobileCommandPaletteProbe";
import type { buildMobileCommandPaletteCommands } from "../workspace/mobileCommandPalette";

type MobileCommandPaletteCommands = ReturnType<
	typeof buildMobileCommandPaletteCommands
>;

export function usePhoneCommandPaletteProof(
	commands: MobileCommandPaletteCommands,
	enabled: boolean,
) {
	useEffect(() => {
		if (enabled) logNativeMobileCommandPaletteProof(commands);
	}, [commands, enabled]);
}
