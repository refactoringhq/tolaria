// @vitest-environment jsdom
import { act, createElement, type ReactNode, useEffect } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, it } from "vitest";
import type { WorkspaceSnapshotPreview } from "../../workspace/workspaceSnapshotPreview";
import { MobileWorkspaceStartup } from "./MobileWorkspaceStartup";
import { useMobileWorkspaceStartupPreview } from "./MobileWorkspaceStartupContext";

const preview: WorkspaceSnapshotPreview = {
	kind: "provisional",
	notes: [],
	allNotes: [],
	typeDefinitions: {},
	sidebarSections: [],
	noteListSubtitle: "",
	source: {
		kind: "localVault",
		label: "Cached QA",
		totalNotes: 1,
		visibleNotes: 1,
		vaultPath: "file:///cached",
	},
};
const roots: ReturnType<typeof createRoot>[] = [];

afterEach(async () => {
	for (const root of roots.splice(0)) await act(async () => root.unmount());
});

it("keeps one live workspace mounted while the cached snapshot becomes available and is replaced", async () => {
	let mounts = 0;
	function LiveWorkspace() {
		useEffect(() => {
			mounts += 1;
		}, []);
		const startup = useMobileWorkspaceStartupPreview();
		return createElement(
			"span",
			{ "data-testid": "live-workspace" },
			startup?.source?.label ?? "prepared workspace",
		);
	}

	const container = document.createElement("div");
	const root = createRoot(container);
	roots.push(root);
	const child: ReactNode = createElement(LiveWorkspace);
	await act(async () =>
		root.render(
			createElement(MobileWorkspaceStartup, { preview: null, children: child }),
		),
	);
	await act(async () =>
		root.render(
			createElement(MobileWorkspaceStartup, { preview, children: child }),
		),
	);
	expect(
		container.querySelector('[data-testid="live-workspace"]')?.textContent,
	).toBe("Cached QA");
	await act(async () =>
		root.render(
			createElement(MobileWorkspaceStartup, { preview: null, children: child }),
		),
	);
	expect(
		container.querySelector('[data-testid="live-workspace"]')?.textContent,
	).toBe("prepared workspace");
	expect(mounts).toBe(1);
});
