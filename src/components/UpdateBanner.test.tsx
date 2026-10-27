import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { UpdateActions, UpdateStatus } from "../hooks/useUpdater";
import { UpdateBanner } from "./UpdateBanner";

// Mock restartApp to prevent dynamic import issues in tests
vi.mock("../hooks/useUpdater", async () => {
	const actual = await vi.importActual("../hooks/useUpdater");
	return {
		...actual,
		restartApp: vi.fn(),
	};
});

function makeActions(overrides?: Partial<UpdateActions>): UpdateActions {
	return {
		startDownload: vi.fn(),
		openReleaseNotes: vi.fn(),
		dismiss: vi.fn(),
		...overrides,
	};
}

const versionStatus = {
	version: "2026.4.16",
	displayVersion: "2026.4.16",
};

function makeStatus(
	state: "available" | "downloading" | "ready",
	overrides: Partial<UpdateStatus> = {},
): UpdateStatus {
	return {
		...versionStatus,
		...(state === "downloading"
			? {
					version: "2026.4.16-alpha.3",
					displayVersion: "Alpha 2026.4.16.3",
					progress: 0.65,
				}
			: {}),
		state,
		...(state === "available" ? { notes: undefined } : {}),
		...overrides,
	} as UpdateStatus;
}

function renderBanner(
	status: UpdateStatus,
	actions = makeActions(),
	locale: "en" | "zh-CN" | "it-IT" = "en",
) {
	const view = render(
		<UpdateBanner status={status} actions={actions} locale={locale} />,
	);
	return { ...view, actions };
}

describe("UpdateBanner", () => {
	it("shows the community banner when idle", () => {
		const status: UpdateStatus = { state: "idle" };
		renderBanner(status);
		expect(screen.getByTestId("community-banner")).toBeInTheDocument();
	});

	it("keeps updater errors in the bottom stack with the community banner", () => {
		renderBanner({ state: "error", kind: "check" });
		const stack = screen.getByTestId("bottom-banner-stack");
		expect(stack).toContainElement(screen.getByTestId("update-banner"));
		expect(stack).toContainElement(screen.getByTestId("community-banner"));
		expect(stack).toHaveTextContent("Could not check for updates");
	});

	it("localizes updater error states", () => {
		renderBanner({ state: "error", kind: "download" }, makeActions(), "it-IT");

		expect(screen.getByTestId("update-banner")).toHaveTextContent(
			"Impossibile scaricare l'aggiornamento",
		);
	});

	it("lets the user dismiss an updater error", () => {
		const { actions } = renderBanner({ state: "error", kind: "check" });

		fireEvent.click(screen.getByTestId("update-dismiss"));

		expect(actions.dismiss).toHaveBeenCalledOnce();
	});

	it("shows immediate feedback while checking for updates", () => {
		renderBanner({ state: "checking" });

		const stack = screen.getByTestId("bottom-banner-stack");
		const banners = Array.from(stack.children);
		expect(banners.map((banner) => banner.getAttribute("data-testid"))).toEqual(
			["update-banner", "community-banner"],
		);
		expect(stack).toHaveTextContent("Checking for updates");
	});

	it("shows version and action buttons when update is available", () => {
		renderBanner(
			makeStatus("available", {
				version: "2026.4.16-alpha.3",
				displayVersion: "Alpha 2026.4.16.3",
				notes: "Bug fixes",
			}),
		);

		expect(screen.getByTestId("update-banner")).toBeTruthy();
		expect(screen.getByText(/Tolaria Alpha 2026\.4\.16\.3/)).toBeTruthy();
		expect(screen.getByText(/is available/)).toBeTruthy();
		expect(screen.getByTestId("update-now-btn")).toBeTruthy();
		expect(screen.getByTestId("update-release-notes")).toBeTruthy();
		expect(screen.getByTestId("update-dismiss")).toBeTruthy();
	});

	it("localizes available update copy", () => {
		renderBanner(
			makeStatus("available", {
				version: "2026.4.16-alpha.3",
				displayVersion: "Alpha 2026.4.16.3",
			}),
			makeActions(),
			"zh-CN",
		);

		expect(screen.getByText(/Tolaria Alpha 2026\.4\.16\.3/)).toBeTruthy();
		expect(screen.getByText(/可用/)).toBeTruthy();
		expect(screen.getByTestId("update-release-notes")).toHaveTextContent(
			"发行说明",
		);
		expect(screen.getByTestId("update-now-btn")).toHaveTextContent("立即更新");
		expect(screen.getByTestId("update-dismiss")).toHaveAttribute(
			"aria-label",
			"关闭",
		);
	});

	it('"Update Now" calls startDownload', () => {
		const { actions } = renderBanner(makeStatus("available"));

		fireEvent.click(screen.getByTestId("update-now-btn"));
		expect(actions.startDownload).toHaveBeenCalledOnce();
	});

	it('"Release Notes" link calls openReleaseNotes', () => {
		const { actions } = renderBanner(makeStatus("available"));

		fireEvent.click(screen.getByTestId("update-release-notes"));
		expect(actions.openReleaseNotes).toHaveBeenCalledOnce();
	});

	it("dismiss button calls dismiss action", () => {
		const { actions } = renderBanner(makeStatus("available"));

		fireEvent.click(screen.getByTestId("update-dismiss"));
		expect(actions.dismiss).toHaveBeenCalledOnce();
	});

	it("shows progress bar during download", () => {
		renderBanner(makeStatus("downloading"));

		expect(
			screen.getByText(/Downloading Tolaria Alpha 2026\.4\.16\.3/),
		).toBeTruthy();
		expect(screen.getByText("65%")).toBeTruthy();

		const progressBar = screen.getByTestId("update-progress");
		expect(progressBar.style.width).toBe("65%");
	});

	it("shows 0% at start of download", () => {
		renderBanner(
			makeStatus("downloading", {
				version: "2026.4.16",
				displayVersion: "2026.4.16",
				progress: 0,
			}),
		);

		expect(screen.getByText("0%")).toBeTruthy();
		const progressBar = screen.getByTestId("update-progress");
		expect(progressBar.style.width).toBe("0%");
	});

	it("shows restart button when update is ready", () => {
		renderBanner(makeStatus("ready"));

		expect(screen.getByText(/Tolaria 2026\.4\.16/)).toBeTruthy();
		expect(screen.getByText(/restart to apply/)).toBeTruthy();
		expect(screen.getByTestId("update-restart-btn")).toBeTruthy();
	});

	it("restart button calls restartApp", async () => {
		const { restartApp } = await import("../hooks/useUpdater");
		renderBanner(makeStatus("ready"));

		fireEvent.click(screen.getByTestId("update-restart-btn"));
		expect(restartApp).toHaveBeenCalled();
	});
});
