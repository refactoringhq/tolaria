import "./App.testUtils";
import {
	act,
	fireEvent,
	screen,
	waitFor,
	within,
} from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import App from "./App";

import {
	clickNoteListItem,
	configureNeighborhoodFavoritesVault,
	configureNeighborhoodVault,
	createSettings,
	enterNeighborhood,
	getHeaderForNoteList,
	mockCommandResults,
	mockEntries,
	pressEscape,
	render,
	SLOW_APP_READY_TIMEOUT_MS,
} from "./App.testUtils";

describe("App.navigation", () => {
	it("renders sidebar with correct default selection (All Notes)", async () => {
		render(<App />);
		await waitFor(() => {
			// "All Notes" should be rendered as the selected nav item
			expect(screen.getByText("All Notes")).toBeInTheDocument();
			expect(screen.getByText("Archive")).toBeInTheDocument();
		});
	});

	it("pressing Escape in Neighborhood mode blurs the editor before unwinding note-list history", async () => {
		configureNeighborhoodVault();

		render(<App />);

		const noteListContainer = await screen.findByTestId(
			"note-list-container",
			{},
			{ timeout: 5000 },
		);
		const getHeader = () => getHeaderForNoteList(noteListContainer);

		await waitFor(() => {
			expect(getHeader()).toHaveTextContent("Inbox");
		});

		await enterNeighborhood({ container: noteListContainer, title: "Alpha" });

		await waitFor(() => {
			expect(getHeader()).toHaveTextContent("Alpha");
		});
		const editor = await screen.findByTestId(
			"mock-editor",
			{},
			{ timeout: SLOW_APP_READY_TIMEOUT_MS },
		);
		editor.focus();
		expect(editor).toHaveFocus();

		await pressEscape();

		await waitFor(() => {
			expect(noteListContainer).toHaveFocus();
			expect(getHeader()).toHaveTextContent("Alpha");
		});

		await enterNeighborhood({ container: noteListContainer, title: "Beta" });

		await waitFor(() => {
			expect(getHeader()).toHaveTextContent("Beta");
		});

		await pressEscape();

		await waitFor(() => {
			expect(getHeader()).toHaveTextContent("Alpha");
		});

		await pressEscape();

		await waitFor(() => {
			expect(getHeader()).toHaveTextContent("Inbox");
		});
	}, 10_000);

	it("opens favorites directly into Neighborhood mode", async () => {
		configureNeighborhoodFavoritesVault();

		render(<App />);

		let favoritesSection: HTMLElement | undefined;
		await waitFor(() => {
			const sidebar = screen.getByText("FAVORITES");
			const currentFavoritesSection = sidebar.closest("div")?.parentElement;
			if (!currentFavoritesSection)
				throw new Error("Expected favorites section");
			expect(
				within(currentFavoritesSection).getByText("Alpha"),
			).toBeInTheDocument();
			favoritesSection = currentFavoritesSection;
		});
		if (!favoritesSection) throw new Error("Expected favorites section");
		fireEvent.click(within(favoritesSection).getByText("Alpha"));

		const noteListContainer = await screen.findByTestId("note-list-container");
		await waitFor(() => {
			expect(getHeaderForNoteList(noteListContainer)).toHaveTextContent(
				"Alpha",
			);
		});

		expect(screen.getByText("Related to")).toBeInTheDocument();
		expect(screen.getByText("Beta")).toBeInTheDocument();
	});

	it("defaults to All Notes when explicit organization is disabled in vault config", async () => {
		const workVaultPath = "/Users/mock/Documents/Work";
		mockCommandResults.load_vault_list = {
			vaults: [{ label: "Work Vault", path: workVaultPath }],
			active_vault: workVaultPath,
			hidden_defaults: [],
		};
		const disabledWorkflowConfig = JSON.stringify({
			zoom: null,
			view_mode: null,
			editor_mode: null,
			tag_colors: null,
			status_colors: null,
			property_display_modes: null,
			inbox: { noteListProperties: null, explicitOrganization: false },
		});
		localStorage.setItem(
			`laputa:vault-config:${workVaultPath}`,
			disabledWorkflowConfig,
		);

		render(<App />);

		await waitFor(() => {
			expect(
				within(screen.getByTestId("sidebar-top-nav")).queryByText("Inbox"),
			).not.toBeInTheDocument();
			expect(screen.getByText("All Notes")).toBeInTheDocument();
		});
	});

	it("auto-advances to the next inbox item after organizing when the setting is enabled", async () => {
		configureNeighborhoodVault();
		mockCommandResults.get_settings = createSettings({
			auto_advance_inbox_after_organize: true,
		});

		render(<App />);

		const noteListContainer = await screen.findByTestId("note-list-container");
		await waitFor(() => {
			expect(getHeaderForNoteList(noteListContainer)).toHaveTextContent(
				"Inbox",
			);
		});

		await clickNoteListItem({ container: noteListContainer, title: "Alpha" });

		expect(
			await screen.findByRole(
				"button",
				{ name: "Set note as organized" },
				{ timeout: SLOW_APP_READY_TIMEOUT_MS },
			),
		).toBeInTheDocument();

		await act(async () => {
			fireEvent.click(
				await screen.findByRole(
					"button",
					{ name: "Set note as organized" },
					{ timeout: SLOW_APP_READY_TIMEOUT_MS },
				),
			);
			await Promise.resolve();
		});

		await waitFor(() => {
			expect(window.__laputaTest?.activeTabPath).toBe("/vault/beta.md");
		});
	}, 10_000);

	it("keeps the manually selected note after organizing finishes later", async () => {
		configureNeighborhoodVault();
		mockCommandResults.get_settings = createSettings({
			auto_advance_inbox_after_organize: true,
		});

		let resolveOrganizeSave!: () => void;
		const organizeSave = new Promise<void>((resolve) => {
			resolveOrganizeSave = resolve;
		});
		mockCommandResults.save_note_content = vi.fn(() => organizeSave);

		render(<App />);

		const noteListContainer = await screen.findByTestId("note-list-container");
		await waitFor(() => {
			expect(getHeaderForNoteList(noteListContainer)).toHaveTextContent(
				"Inbox",
			);
		});

		await clickNoteListItem({ container: noteListContainer, title: "Alpha" });

		expect(
			await screen.findByRole(
				"button",
				{ name: "Set note as organized" },
				{ timeout: SLOW_APP_READY_TIMEOUT_MS },
			),
		).toBeInTheDocument();

		await act(async () => {
			fireEvent.click(
				await screen.findByRole(
					"button",
					{ name: "Set note as organized" },
					{ timeout: SLOW_APP_READY_TIMEOUT_MS },
				),
			);
			await Promise.resolve();
		});

		await act(async () => {
			fireEvent.click(within(noteListContainer).getByText("Gamma"));
			await Promise.resolve();
		});
		await waitFor(() => {
			expect(window.__laputaTest?.activeTabPath).toBe("/vault/gamma.md");
		});

		await act(async () => {
			resolveOrganizeSave();
			await organizeSave;
			await Promise.resolve();
			await Promise.resolve();
		});

		expect(window.__laputaTest?.activeTabPath).toBe("/vault/gamma.md");
	}, 10_000);

	it("renders status bar", async () => {
		render(<App />);
		// StatusBar should be present
		await waitFor(() => {
			expect(screen.getByText("All Notes")).toBeInTheDocument();
		});
		// The status bar element should exist in the DOM
		const appShell = document.querySelector(".app-shell");
		expect(appShell).toBeInTheDocument();
	});

	it("switches vaults from the bottom bar after onboarding is ready", async () => {
		let resolveSwitchedVaultScan: ((value: typeof mockEntries) => void) | null =
			null;
		const switchedVaultScan = new Promise<typeof mockEntries>((resolve) => {
			resolveSwitchedVaultScan = resolve;
		});
		mockCommandResults.load_vault_list = {
			vaults: [
				{ label: "Test Vault", path: "/work" },
				{ label: "Work Vault", path: "/vault-2" },
			],
			active_vault: "/work",
			hidden_defaults: [],
		};
		mockCommandResults.list_vault = ({ path }: { path?: string } = {}) =>
			path === "/vault-2" ? switchedVaultScan : mockEntries;

		render(<App />);

		await waitFor(() => {
			expect(screen.getByTestId("status-vault-trigger")).toHaveTextContent(
				"Test Vault",
			);
		});

		fireEvent.click(screen.getByRole("button", { name: "Switch vault" }));
		fireEvent.click(screen.getByTestId("vault-menu-item-Work Vault"));

		expect(
			await screen.findByTestId("sidebar-loading-favorites"),
		).toBeInTheDocument();
		expect(
			screen.queryByTestId("startup-shell-fallback"),
		).not.toBeInTheDocument();
		expect(
			screen.getByTestId("note-list-loading-skeleton"),
		).toBeInTheDocument();

		await act(async () => {
			resolveSwitchedVaultScan?.(mockEntries);
			await Promise.resolve();
		});

		await waitFor(() => {
			expect(screen.getByTestId("status-vault-trigger")).toHaveTextContent(
				"Work Vault",
			);
		});
	});

	it("clears the Git setup dialog when switching to a Git-enabled vault", async () => {
		mockCommandResults.load_vault_list = {
			vaults: [
				{ label: "Missing Git", path: "/work" },
				{ label: "Git Vault", path: "/vault-2" },
			],
			active_vault: "/work",
			hidden_defaults: [],
		};
		mockCommandResults.is_git_repo = ({
			vaultPath,
		}: {
			vaultPath?: string;
		} = {}) => vaultPath === "/vault-2";

		render(<App />);

		expect(
			await screen.findByTestId(
				"status-missing-git",
				{},
				{ timeout: SLOW_APP_READY_TIMEOUT_MS },
			),
		).toBeInTheDocument();
		fireEvent.click(screen.getByTestId("status-missing-git"));
		expect(
			await screen.findByText("Enable Git for this vault?"),
		).toBeInTheDocument();

		fireEvent.click(screen.getByTestId("status-vault-trigger"));
		fireEvent.click(screen.getByTestId("vault-menu-item-Git Vault"));

		await waitFor(() => {
			expect(screen.getByTestId("status-vault-trigger")).toHaveTextContent(
				"Git Vault",
			);
		});
		await waitFor(() => {
			expect(
				screen.queryByText("Enable Git for this vault?"),
			).not.toBeInTheDocument();
		});
	});

	it("Cmd+1 hides sidebar and note list (editor-only mode)", async () => {
		render(<App />);
		await waitFor(() => {
			expect(screen.getByText("All Notes")).toBeInTheDocument();
		});

		// All panels visible by default
		expect(document.querySelector(".app__sidebar")).toBeInTheDocument();
		expect(document.querySelector(".app__note-list")).toBeInTheDocument();

		// Cmd+1 → editor-only
		fireEvent.keyDown(window, { key: "1", metaKey: true });
		await waitFor(() => {
			expect(document.querySelector(".app__sidebar")).not.toBeInTheDocument();
			expect(document.querySelector(".app__note-list")).not.toBeInTheDocument();
		});
	});

	it("Cmd+2 shows editor + note list (sidebar hidden)", async () => {
		render(<App />);
		await waitFor(() => {
			expect(screen.getByText("All Notes")).toBeInTheDocument();
		});

		fireEvent.keyDown(window, { key: "2", metaKey: true });
		await waitFor(() => {
			expect(document.querySelector(".app__sidebar")).not.toBeInTheDocument();
			expect(document.querySelector(".app__note-list")).toBeInTheDocument();
		});
	});

	it("Cmd+3 restores all panels after Cmd+1", async () => {
		render(<App />);
		await waitFor(() => {
			expect(screen.getByText("All Notes")).toBeInTheDocument();
		});

		// Switch to editor-only first
		fireEvent.keyDown(window, { key: "1", metaKey: true });
		await waitFor(() => {
			expect(document.querySelector(".app__sidebar")).not.toBeInTheDocument();
		});

		// Cmd+3 → all panels
		fireEvent.keyDown(window, { key: "3", metaKey: true });
		await waitFor(() => {
			expect(document.querySelector(".app__sidebar")).toBeInTheDocument();
			expect(document.querySelector(".app__note-list")).toBeInTheDocument();
		});
	});

	it("updates the main-window size constraints when the view mode changes", async () => {
		const { invoke } = (await import("@tauri-apps/api/core")) as {
			invoke: ReturnType<typeof vi.fn>;
		};

		render(<App />);
		await waitFor(() => {
			expect(screen.getByText("All Notes")).toBeInTheDocument();
		});

		invoke.mockClear();

		fireEvent.keyDown(window, { key: "1", metaKey: true });
		await waitFor(() => {
			expect(invoke).toHaveBeenCalledWith("update_current_window_min_size", {
				minWidth: 480,
				minHeight: 400,
				growToFit: true,
			});
		});

		invoke.mockClear();

		fireEvent.keyDown(window, { key: "3", metaKey: true });
		await waitFor(() => {
			expect(invoke).toHaveBeenCalledWith("update_current_window_min_size", {
				minWidth: 1030,
				minHeight: 400,
				growToFit: true,
			});
		});
	});

	it("does not ask Windows to grow the native window when toggling Properties", async () => {
		const { invoke } = (await import("@tauri-apps/api/core")) as {
			invoke: ReturnType<typeof vi.fn>;
		};
		const originalUserAgent = navigator.userAgent;
		Object.defineProperty(window.navigator, "userAgent", {
			configurable: true,
			value: "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
		});

		try {
			render(<App />);
			await waitFor(() => {
				expect(screen.getByText("All Notes")).toBeInTheDocument();
			});

			invoke.mockClear();

			fireEvent.keyDown(window, { key: "I", metaKey: true, shiftKey: true });
			await waitFor(() => {
				expect(invoke).toHaveBeenCalledWith(
					"update_current_window_min_size",
					expect.objectContaining({
						growToFit: false,
					}),
				);
			});
		} finally {
			Object.defineProperty(window.navigator, "userAgent", {
				configurable: true,
				value: originalUserAgent,
			});
		}
	});
});
