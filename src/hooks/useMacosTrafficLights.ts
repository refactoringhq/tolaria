import { invoke } from "@tauri-apps/api/core";
import { useEffect } from "react";
import { isTauri } from "../mock-tauri";
import { isMac } from "../utils/platform";

const WORKSPACE_PANES =
	"[data-desktop-sidebar-chrome] > :is(.app__sidebar, .app__note-list, .app__editor)";
const HEADER_HEIGHT = 52;

function trafficLightCenter(pane: Element) {
	const vaultIcon = pane
		.querySelector('[data-testid="status-vault-trigger"] svg')
		?.getBoundingClientRect();
	if (vaultIcon) return vaultIcon.left + vaultIcon.width / 2;

	// Calendar keeps its surface inset even though the toolbar sits on the window glass.
	const header = pane.querySelector(
		':scope > [data-collection-layout="calendar"]',
	)
		? pane.parentElement
		: pane;
	return (header?.getBoundingClientRect().left ?? 0) + HEADER_HEIGHT / 2;
}

function trafficLightHeader(zoomLevel: number) {
	const pane = document.querySelector(WORKSPACE_PANES);
	const centerX = pane ? trafficLightCenter(pane) : HEADER_HEIGHT / 2;
	const scale = zoomLevel / 100;
	return {
		centerX: centerX * scale,
		top: (pane?.getBoundingClientRect().top ?? 0) * scale,
		height: HEADER_HEIGHT * scale,
	};
}

function hasMacosTrafficLights() {
	return isTauri() && isMac();
}

export function useMacosTrafficLights({
	enabled,
	sidebarVisible,
	ready,
	zoomLevel,
}: {
	enabled: boolean;
	sidebarVisible: boolean;
	ready: boolean;
	zoomLevel: number;
}) {
	useEffect(() => {
		if (!enabled || !hasMacosTrafficLights()) return;

		let pendingFrame = 0;
		const update = () => {
			cancelAnimationFrame(pendingFrame);
			pendingFrame = requestAnimationFrame(() => {
				void invoke("update_macos_traffic_light_position", {
					header: trafficLightHeader(zoomLevel),
				}).catch((error: unknown) => {
					console.warn("[window] Traffic light alignment failed:", error);
				});
			});
		};

		update();
		// Layouts can change the header inset while the sidebar remains hidden.
		const pane = document.querySelector(WORKSPACE_PANES);
		const observer = new ResizeObserver(update);
		if (pane) observer.observe(pane);
		// AppKit can relayout the titlebar on resize, including when leaving fullscreen.
		window.addEventListener("resize", update);
		window.addEventListener("focus", update);
		window.addEventListener("laputa-zoom-change", update);
		return () => {
			cancelAnimationFrame(pendingFrame);
			observer.disconnect();
			window.removeEventListener("resize", update);
			window.removeEventListener("focus", update);
			window.removeEventListener("laputa-zoom-change", update);
		};
	}, [enabled, ready, sidebarVisible, zoomLevel]);
}
