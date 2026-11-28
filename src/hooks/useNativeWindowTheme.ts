import { getCurrentWindow } from "@tauri-apps/api/window";
import { useEffect } from "react";
import { isTauri } from "../mock-tauri";
import { useDocumentThemeMode } from "./useDocumentThemeMode";

/**
 * Gives the native window the app's theme, not the system's. On macOS the sidebar glass
 * (ADR 0313) is drawn by the window material, which otherwise follows the system appearance:
 * a light app on a dark Mac got dark glass under light-theme text.
 */
export function useNativeWindowTheme(): void {
	const themeMode = useDocumentThemeMode();
	useEffect(() => {
		if (!isTauri()) return;
		getCurrentWindow()
			.setTheme(themeMode)
			.catch(() => {
				// Platforms without a native theme keep the system appearance.
			});
	}, [themeMode]);
}
