import { useEffect, useRef } from "react";
import type { TabletPanelGestures } from "./TabletWorkspacePanels";
import type { TabletTransitionProbeMode } from "./tabletWorkspaceTypes";

type TransitionActions = Pick<
	TabletPanelGestures,
	"hideLeftChrome" | "hideProperties" | "showLeftChrome" | "showProperties"
>;

export function useTabletTransitionProbe(
	mode: TabletTransitionProbeMode,
	gestures: TabletPanelGestures,
) {
	const actionsRef = useRef({
		hideLeftChrome: gestures.hideLeftChrome,
		hideProperties: gestures.hideProperties,
		showLeftChrome: gestures.showLeftChrome,
		showProperties: gestures.showProperties,
	});

	useEffect(() => {
		actionsRef.current = {
			hideLeftChrome: gestures.hideLeftChrome,
			hideProperties: gestures.hideProperties,
			showLeftChrome: gestures.showLeftChrome,
			showProperties: gestures.showProperties,
		};
	}, [
		gestures.hideLeftChrome,
		gestures.hideProperties,
		gestures.showLeftChrome,
		gestures.showProperties,
	]);

	useEffect(() => {
		if (!mode) return;
		const timers = transitionProbeTimers(mode, () => actionsRef.current);
		return () => timers.forEach(clearTimeout);
	}, [mode]);
}

function transitionProbeTimers(
	mode: Exclude<TabletTransitionProbeMode, false>,
	currentActions: () => TransitionActions,
) {
	if (mode === "properties") {
		return [
			setTimeout(() => currentActions().hideProperties(), 1400),
			setTimeout(() => currentActions().showProperties(), 3600),
			setTimeout(() => currentActions().hideProperties(), 5800),
			setTimeout(() => currentActions().showProperties(), 8000),
		];
	}
	return [
		setTimeout(() => currentActions().hideLeftChrome(), 1200),
		setTimeout(() => currentActions().showLeftChrome(), 2600),
		setTimeout(() => currentActions().hideProperties(), 4000),
		setTimeout(() => currentActions().showProperties(), 5400),
	];
}
