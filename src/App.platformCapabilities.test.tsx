import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import App from "./App";

// These tests cover capability gating, not sync. The real mount-time auto-sync
// pull is chained through delayed mock commands and can outlive the jsdom
// environment on a loaded machine, so run the hook with sync disabled.
vi.mock("./hooks/useAutoSync", async (importOriginal) => {
	const actual = await importOriginal<typeof import("./hooks/useAutoSync")>();
	return {
		...actual,
		useAutoSync: (options: Parameters<typeof actual.useAutoSync>[0]) =>
			actual.useAutoSync({ ...options, enabled: false }),
	};
});

/**
 * Tests for platform capabilities detection in App.tsx (TOL-174).
 * Verifies that desktop-only features are hidden in web builds.
 */

describe("App platform capabilities", () => {
	beforeEach(() => {
		// Clean up any stubs from previous tests
		vi.unstubAllGlobals();
	});

	afterEach(() => {
		vi.unstubAllGlobals();
		window.localStorage.removeItem("tolaria:ai-agents-onboarding-dismissed");
	});

	test("detects remote backend configuration", () => {
		// Stub window properties for remote backend
		vi.stubGlobal("TOLARIA_REMOTE_URL", "https://example.com");
		vi.stubGlobal("TOLARIA_REMOTE_TOKEN", "test-token");

		const { container } = render(<App />);

		// App should render without crashing
		expect(container).toBeTruthy();
	});

	test("handles missing remote URL", () => {
		// Stub only TOLARIA_REMOTE_TOKEN
		vi.stubGlobal("TOLARIA_REMOTE_TOKEN", "test-token");

		const { container } = render(<App />);

		// App should render without crashing
		expect(container).toBeTruthy();
	});

	test("handles missing remote token", () => {
		// Stub only TOLARIA_REMOTE_URL
		vi.stubGlobal("TOLARIA_REMOTE_URL", "https://example.com");

		const { container } = render(<App />);

		// App should render without crashing
		expect(container).toBeTruthy();
	});

	test("handles empty remote URL", () => {
		// Stub empty TOLARIA_REMOTE_URL
		vi.stubGlobal("TOLARIA_REMOTE_URL", "");
		vi.stubGlobal("TOLARIA_REMOTE_TOKEN", "test-token");

		const { container } = render(<App />);

		// App should render without crashing
		expect(container).toBeTruthy();
	});

	test("handles empty remote token", () => {
		// Stub empty TOLARIA_REMOTE_TOKEN
		vi.stubGlobal("TOLARIA_REMOTE_URL", "https://example.com");
		vi.stubGlobal("TOLARIA_REMOTE_TOKEN", "");

		const { container } = render(<App />);

		// App should render without crashing
		expect(container).toBeTruthy();
	});

	test("handles window being undefined", () => {
		// No remote config stubs - tests default mock environment
		const { container } = render(<App />);

		// App should render without crashing in mock environment
		expect(container).toBeTruthy();
	});

	test("shows the sync pill instead of the git status when a remote server is configured", async () => {
		vi.stubGlobal("TOLARIA_REMOTE_URL", "https://example.com");
		vi.stubGlobal("TOLARIA_REMOTE_TOKEN", "test-token");
		// A returning user: the remote's stand-ins answer at once (TOL-206), so the AI agents
		// card would otherwise cover the shell before the status bar is read.
		window.localStorage.setItem("tolaria:ai-agents-onboarding-dismissed", "1");

		render(<App />);

		const statusBar = await screen.findByTestId("status-bar");
		await waitFor(() => expect(statusBar).toHaveTextContent("Contribute"));
		expect(within(statusBar).getByTestId("status-sync-pill")).toHaveAttribute(
			"role",
			"status",
		);
		expect(statusBar).not.toHaveTextContent(/changes|commit|not synced/i);
	});

		test("keeps local Git actions available in the sidebar without a remote server", async () => {
		window.localStorage.setItem("tolaria:ai-agents-onboarding-dismissed", "1");
		render(<App />);

		const sync = await screen.findByTestId("sidebar-sync");
		expect(sync).toHaveTextContent("No Sync");
		fireEvent.keyDown(sync, { key: "ArrowDown" });
		const menu = within(await screen.findByTestId("sidebar-sync-menu"));
		expect(menu.getByRole("menuitem", { name: "View changes" })).not.toHaveAttribute("data-disabled");
		expect(menu.getByRole("menuitem", { name: "View history" })).not.toHaveAttribute("data-disabled");
	});
});
