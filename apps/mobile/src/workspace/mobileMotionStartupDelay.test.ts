import { afterEach, expect, it, vi } from "vitest";
import { waitForMotionStartupDelay } from "./mobileMotionStartupDelay";

afterEach(() => {
	vi.unstubAllEnvs();
	vi.unstubAllGlobals();
	vi.useRealTimers();
});

it("keeps the artificial startup delay disabled outside development", async () => {
	vi.stubGlobal("__DEV__", false);
	vi.stubEnv("EXPO_PUBLIC_TOLARIA_MOTION_STARTUP_DELAY_MS", "5000");
	await expect(
		waitForMotionStartupDelay(new AbortController().signal),
	).resolves.toBeUndefined();
});

it("waits only for the configured debug delay and releases promptly on cancellation", async () => {
	vi.stubGlobal("__DEV__", true);
	vi.stubEnv("EXPO_PUBLIC_TOLARIA_MOTION_STARTUP_DELAY_MS", "5000");
	vi.useFakeTimers();
	const controller = new AbortController();
	const waiting = waitForMotionStartupDelay(controller.signal);
	await vi.advanceTimersByTimeAsync(4999);
	controller.abort();
	await expect(waiting).resolves.toBeUndefined();
	expect(vi.getTimerCount()).toBe(0);
});
