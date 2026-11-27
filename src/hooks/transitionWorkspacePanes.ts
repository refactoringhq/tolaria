import { flushSync } from "react-dom";
import { isTauri } from "../mock-tauri";

type WorkspacePane = "left" | "properties" | "ai";
type Update = () => void;

interface PaneTransition {
	animation: ViewTransition;
	pending: Update[];
}

let current: PaneTransition | undefined;

function canAnimateWorkspace() {
	return (
		typeof document.startViewTransition === "function" &&
		!document.hidden &&
		isTauri() &&
		!window.matchMedia("(prefers-reduced-motion: reduce)").matches &&
		document.querySelector(".app[data-desktop-sidebar-chrome]") !== null
	);
}

function startPaneTransition(pane: WorkspacePane, update: Update) {
	const root = document.documentElement;
	const pending = [update];
	root.dataset.workspaceMotion = pane;
	const animation = document.startViewTransition(() => {
		const updates = pending.splice(0);
		flushSync(() => {
			for (const apply of updates) apply();
		});
	});
	current = { animation, pending };
	void Promise.allSettled([
		animation.ready,
		animation.updateCallbackDone,
		animation.finished,
	]).then(() => {
		if (current?.animation !== animation) return;
		current = undefined;
		delete root.dataset.workspaceMotion;
	});
}

/** Commit once, and skip the visual transition if another command arrives. */
export function transitionWorkspacePanes(pane: WorkspacePane, update: Update) {
	if (current) {
		current.animation.skipTransition();
		if (current.pending.length) current.pending.push(update);
		else update();
		return;
	}
	if (canAnimateWorkspace()) startPaneTransition(pane, update);
	else update();
}
