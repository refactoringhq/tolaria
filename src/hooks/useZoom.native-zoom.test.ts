import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
	bindVaultConfigStore,
	resetVaultConfigStore,
} from "../utils/vaultConfigStore";
import { useZoom } from "./useZoom";

const setWebviewZoom = vi.fn().mockResolvedValue(undefined);

vi.mock("@tauri-apps/api/webview", () => ({
	getCurrentWebview: () => ({ setZoom: setWebviewZoom }),
}));

describe("native desktop zoom", () => {
	beforeEach(() => {
		resetVaultConfigStore();
		bindVaultConfigStore(
			{
				zoom: null,
				view_mode: null,
				editor_mode: null,
				tag_colors: null,
				status_colors: null,
				property_display_modes: null,
			},
			vi.fn(),
		);
		Reflect.deleteProperty(globalThis, "isTauri");
		setWebviewZoom.mockClear();
	});

	afterEach(() => {
		Reflect.deleteProperty(globalThis, "isTauri");
	});

	it("uses native webview zoom without CSS zoom", async () => {
		Object.assign(globalThis, { isTauri: true });

		const { result } = renderHook(() => useZoom());
		await vi.waitFor(() => expect(setWebviewZoom).toHaveBeenLastCalledWith(1));

		act(() => result.current.zoomIn());
		await vi.waitFor(() =>
			expect(setWebviewZoom).toHaveBeenLastCalledWith(1.1),
		);

		expect(document.documentElement.style.getPropertyValue("zoom")).toBe("");
		expect(
			document.documentElement.style.getPropertyValue(
				"--tolaria-overlay-zoom-factor",
			),
		).toBe("1");
	});

	it.each([80, 90, 100, 110, 120, 125, 150])(
		"restores %i%% with native webview zoom",
		async (percent) => {
			Object.assign(globalThis, { isTauri: true });
			bindVaultConfigStore(
				{
					zoom: percent / 100,
					view_mode: null,
					editor_mode: null,
					tag_colors: null,
					status_colors: null,
					property_display_modes: null,
				},
				vi.fn(),
			);

			renderHook(() => useZoom());
			await vi.waitFor(() =>
				expect(setWebviewZoom).toHaveBeenLastCalledWith(percent / 100),
			);

			expect(document.documentElement.style.getPropertyValue("zoom")).toBe("");
			expect(
				document.documentElement.style.getPropertyValue(
					"--tolaria-overlay-zoom-factor",
				),
			).toBe("1");
		},
	);
});
