import { cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const setTheme = vi.fn(async () => undefined);
const tauri = { value: true };
vi.mock("@tauri-apps/api/window", () => ({
	getCurrentWindow: () => ({ setTheme }),
}));
vi.mock("../mock-tauri", () => ({ isTauri: () => tauri.value }));

const { useNativeWindowTheme } = await import("./useNativeWindowTheme");

afterEach(() => {
	cleanup();
	setTheme.mockClear();
	tauri.value = true;
	document.documentElement.removeAttribute("data-theme");
});

describe("useNativeWindowTheme", () => {
	it("sets the native window to the app theme and follows later changes", async () => {
		document.documentElement.setAttribute("data-theme", "light");
		renderHook(() => useNativeWindowTheme());
		await waitFor(() => expect(setTheme).toHaveBeenLastCalledWith("light"));

		document.documentElement.setAttribute("data-theme", "dark");
		await waitFor(() => expect(setTheme).toHaveBeenLastCalledWith("dark"));
	});

	it("leaves the window alone outside the desktop app", () => {
		tauri.value = false;
		renderHook(() => useNativeWindowTheme());
		expect(setTheme).not.toHaveBeenCalled();
	});
});
