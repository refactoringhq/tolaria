import { beforeEach, expect, it, vi } from "vitest";

const haptics = vi.hoisted(() => ({
	impactAsync: vi.fn(() => Promise.resolve()),
	notificationAsync: vi.fn(() => Promise.resolve()),
	selectionAsync: vi.fn(() => Promise.resolve()),
}));
vi.mock("expo-haptics", () => ({
	ImpactFeedbackStyle: { Light: "light" },
	NotificationFeedbackType: { Success: "success", Warning: "warning" },
	impactAsync: haptics.impactAsync,
	notificationAsync: haptics.notificationAsync,
	selectionAsync: haptics.selectionAsync,
}));

import { emitMobileHaptic } from "./mobileHaptics";

beforeEach(() => {
	haptics.impactAsync.mockClear();
	haptics.notificationAsync.mockClear();
	haptics.selectionAsync.mockClear();
});

it("maps selection and commit feedback to lightweight native haptics", async () => {
	await emitMobileHaptic("selection");
	await emitMobileHaptic("light");
	expect(haptics.selectionAsync).toHaveBeenCalledOnce();
	expect(haptics.impactAsync).toHaveBeenCalledWith("light");
});

it("maps successful and destructive outcomes to notification feedback", async () => {
	await emitMobileHaptic("success");
	await emitMobileHaptic("warning");
	expect(haptics.notificationAsync).toHaveBeenNthCalledWith(1, "success");
	expect(haptics.notificationAsync).toHaveBeenNthCalledWith(2, "warning");
});

it("contains haptic failures so optional device feedback never interrupts an action", async () => {
	haptics.selectionAsync.mockRejectedValueOnce(new Error("not available"));
	await expect(emitMobileHaptic("selection")).resolves.toBeUndefined();
});
