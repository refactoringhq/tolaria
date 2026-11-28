import "./App.testUtils";
import { act, fireEvent, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import App from "./App";
import {
	AI_AGENTS_ONBOARDING_DISMISSED_STORAGE_NAME,
	CLAUDE_CODE_ONBOARDING_DISMISSED_STORAGE_NAME,
	createMockUpdaterResult,
	createSettings,
	mockCommandResults,
	render,
	SLOW_APP_READY_TIMEOUT_MS,
} from "./App.testUtils";
import type { UpdateCheckResult, UpdateStatus } from "./hooks/useUpdater";
import { useUpdater } from "./hooks/useUpdater";
import type { Settings } from "./types";
import { streamAiAgent } from "./utils/streamAiAgent";

function mockUpdaterWithStatus(
	checkForUpdates: () => Promise<UpdateCheckResult>,
) {
	vi.mocked(useUpdater).mockImplementation(() => {
		const [status, setStatus] = useState<UpdateStatus>({ state: "idle" });
		return {
			status,
			actions: {
				checkForUpdates: async () => {
					setStatus({ state: "checking" });
					const result = await checkForUpdates();
					if (result.kind === "available") {
						setStatus({
							state: "available",
							version: result.version,
							displayVersion: result.displayVersion,
							notes: undefined,
						});
					} else if (result.kind === "error") {
						setStatus({ state: "error", kind: "check" });
					} else {
						setStatus({ state: "idle" });
					}
					return result;
				},
				startDownload: vi.fn(),
				openReleaseNotes: vi.fn(),
				dismiss: vi.fn(),
			},
		};
	});
}

describe("App.integrations", () => {
	it("shows visible feedback when a manual update check finds an update", async () => {
		mockUpdaterWithStatus(async () => ({
			kind: "available",
			version: "2026.4.25",
			displayVersion: "2026.4.25",
		}));

		render(<App />);

		await waitFor(() => {
			expect(screen.getByText("All Notes")).toBeInTheDocument();
		});

		fireEvent.click(screen.getByTestId("status-build-number"));

		await waitFor(() => {
			const bottomStack = screen.getByTestId("app-bottom-banner-stack");
			expect(bottomStack).toContainElement(screen.getByTestId("update-banner"));
			expect(screen.getByTestId("update-banner")).toHaveTextContent(
				"Tolaria 2026.4.25 is available",
			);
		});
	});

	it("shows visible feedback when a menu-driven update check finds no eligible update", async () => {
		vi.mocked(useUpdater).mockReturnValue(
			createMockUpdaterResult(async () => ({ kind: "up-to-date" })),
		);

		render(<App />);

		await waitFor(() => {
			expect(screen.getByText("All Notes")).toBeInTheDocument();
			expect(typeof window.__laputaTest?.dispatchBrowserMenuCommand).toBe(
				"function",
			);
		});

		act(() => {
			window.__laputaTest?.dispatchBrowserMenuCommand?.(
				"app-check-for-updates",
			);
		});

		await waitFor(() => {
			expect(
				screen.getByText("No newer stable update is available right now"),
			).toBeInTheDocument();
		});
	});

	it("shows immediate feedback while a menu-driven update check is pending", async () => {
		let resolveUpdate: ((result: { kind: "up-to-date" }) => void) | null = null;
		const checkForUpdates = vi.fn(
			() =>
				new Promise<{ kind: "up-to-date" }>((resolve) => {
					resolveUpdate = resolve;
				}),
		);
		mockUpdaterWithStatus(checkForUpdates);

		render(<App />);

		await waitFor(() => {
			expect(screen.getByText("All Notes")).toBeInTheDocument();
			expect(typeof window.__laputaTest?.dispatchBrowserMenuCommand).toBe(
				"function",
			);
		});

		act(() => {
			window.__laputaTest?.dispatchBrowserMenuCommand?.(
				"app-check-for-updates",
			);
		});

		await waitFor(() => {
			const bottomStack = screen.getByTestId("app-bottom-banner-stack");
			expect(bottomStack).toContainElement(screen.getByTestId("update-banner"));
			expect(bottomStack).toHaveTextContent("Checking for updates...");
		});
		expect(checkForUpdates).toHaveBeenCalledOnce();

		await act(async () => {
			resolveUpdate?.({ kind: "up-to-date" });
			await Promise.resolve();
		});

		await waitFor(() => {
			expect(
				screen.getByText("No newer stable update is available right now"),
			).toBeInTheDocument();
		});
	});

	it("shows the external AI setup dialog from the menu when AI onboarding is active", async () => {
		localStorage.removeItem(AI_AGENTS_ONBOARDING_DISMISSED_STORAGE_NAME);
		localStorage.removeItem(CLAUDE_CODE_ONBOARDING_DISMISSED_STORAGE_NAME);
		mockCommandResults.get_ai_agents_status = {
			claude_code: { installed: true, version: "2.1.90" },
			codex: { installed: true, version: "0.122.0-alpha.1" },
			opencode: { installed: false, version: null },
			pi: { installed: false, version: null },
			antigravity: { installed: false, version: null },
		};
		mockCommandResults.check_mcp_status = "installed";

		render(<App />);

		await waitFor(
			() => {
				expect(screen.getByText("AI is ready")).toBeInTheDocument();
			},
			{ timeout: SLOW_APP_READY_TIMEOUT_MS },
		);

		await waitFor(() => {
			expect(typeof window.__laputaTest?.dispatchBrowserMenuCommand).toBe(
				"function",
			);
		});

		act(() => {
			window.__laputaTest?.dispatchBrowserMenuCommand?.("vault-install-mcp");
		});

		await waitFor(() => {
			expect(screen.getByText("Manage External AI Tools")).toBeInTheDocument();
		});
		expect(screen.getByTestId("mcp-setup-dialog")).toBeInTheDocument();
		expect(screen.queryByText("AI is ready")).not.toBeInTheDocument();
	});

	it("routes right-panel AI chat messages to the selected default agent", async () => {
		mockCommandResults.get_settings = createSettings({
			auto_advance_inbox_after_organize: null,
			default_ai_agent: "codex",
		});
		mockCommandResults.get_ai_agents_status = {
			claude_code: { installed: true, version: "2.1.90" },
			codex: { installed: true, version: "0.122.0-alpha.1" },
			opencode: { installed: false, version: null },
			pi: { installed: false, version: null },
			antigravity: { installed: false, version: null },
		};

		render(<App />);

		await screen.findByText("All Notes");
		fireEvent.keyDown(window, {
			key: "l",
			code: "KeyL",
			metaKey: true,
			shiftKey: true,
		});

		const input = await screen.findByTestId("agent-input");
		await waitFor(() => {
			expect(input).toHaveAttribute("aria-placeholder", "Ask Codex");
		});

		input.textContent = "Summarize the active vault";
		fireEvent.input(input);
		fireEvent.click(screen.getByTestId("agent-send"));

		await waitFor(() => {
			expect(streamAiAgent).toHaveBeenCalledWith(
				expect.objectContaining({
					agent: "codex",
				}),
			);
		});
	});

	it("waits for saved AI agent settings before sending right-panel messages", async () => {
		let resolveSettings: ((settings: Settings) => void) | null = null;
		mockCommandResults.get_settings = () =>
			new Promise((resolve) => {
				resolveSettings = resolve;
			});
		mockCommandResults.get_ai_agents_status = {
			claude_code: { installed: true, version: "2.1.90" },
			codex: { installed: true, version: "0.122.0-alpha.1" },
			opencode: { installed: false, version: null },
			pi: { installed: false, version: null },
			antigravity: { installed: false, version: null },
		};

		render(<App />);

		await screen.findByText("All Notes");
		fireEvent.keyDown(window, {
			key: "l",
			code: "KeyL",
			metaKey: true,
			shiftKey: true,
		});

		const input = await screen.findByTestId("agent-input");
		fireEvent.click(screen.getByTestId("agent-send"));

		await act(async () => {
			await Promise.resolve();
		});
		expect(streamAiAgent).not.toHaveBeenCalled();

		await act(async () => {
			resolveSettings?.(
				createSettings({
					auto_advance_inbox_after_organize: null,
					default_ai_agent: "codex",
				}),
			);
		});

		await waitFor(() => {
			expect(input).toHaveAttribute("aria-placeholder", "Ask Codex");
		});

		input.textContent = "Summarize the active vault";
		fireEvent.input(input);
		fireEvent.click(screen.getByTestId("agent-send"));

		await waitFor(() => {
			expect(streamAiAgent).toHaveBeenCalledWith(
				expect.objectContaining({
					agent: "codex",
				}),
			);
		});
	});
});
