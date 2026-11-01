import { expect, it, vi } from "vitest";
import { defaultMobileSettings } from "./mobileSettings";
import { createMobileSettingsController } from "./mobileSettingsController";

it("does not turn on AutoGit when saving its preference fails", async () => {
	const storage = {
		read: async () => defaultMobileSettings,
		write: vi.fn().mockRejectedValue(new Error("disk full")),
	};
	const controller = createMobileSettingsController(storage);
	await controller.load();
	expect(await controller.update({ autoGit: true })).toBe(false);
	expect(controller.snapshot()).toMatchObject({
		settings: { autoGit: false },
		error: "save",
		saving: false,
	});
});

it("never overwrites an unreadable settings file with defaults", async () => {
	const storage = {
		read: vi.fn().mockRejectedValue(new Error("unreadable")),
		write: vi.fn(),
	};
	const controller = createMobileSettingsController(storage);
	await controller.load();
	expect(await controller.update({ autoGit: true })).toBe(false);
	expect(storage.write).not.toHaveBeenCalled();
	expect(controller.snapshot().error).toBe("load");
});

it("publishes a new preference only after persistence completes", async () => {
	const storage = {
		read: async () => defaultMobileSettings,
		write: vi.fn().mockResolvedValue(undefined),
	};
	const controller = createMobileSettingsController(storage);
	await controller.load();
	expect(await controller.update({ autoGit: true })).toBe(true);
	expect(storage.write).toHaveBeenCalledWith({
		...defaultMobileSettings,
		autoGit: true,
	});
	expect(controller.snapshot().settings.autoGit).toBe(true);
});

it("persists the native settings controls together as device preferences", async () => {
	const storage = {
		read: async () => defaultMobileSettings,
		write: vi.fn().mockResolvedValue(undefined),
	};
	const controller = createMobileSettingsController(storage);
	await controller.load();
	const settings = {
		autoGit: true,
		analytics: true,
		crashReporting: true,
		theme: "dark" as const,
		updateChannel: "alpha" as const,
	};
	expect(await controller.update(settings)).toBe(true);
	expect(storage.write).toHaveBeenLastCalledWith({
		...defaultMobileSettings,
		...settings,
	});
	expect(controller.snapshot().settings).toMatchObject(settings);
});

it("ignores duplicate loads and never reloads over a saved preference", async () => {
	const storage = {
		read: vi.fn(async () => defaultMobileSettings),
		write: vi.fn().mockResolvedValue(undefined),
	};
	const controller = createMobileSettingsController(storage);
	await Promise.all([controller.load(), controller.load()]);
	expect(storage.read).toHaveBeenCalledOnce();
	await controller.update({ autoGit: true });
	await controller.load();
	expect(controller.snapshot().settings.autoGit).toBe(true);
	expect(storage.read).toHaveBeenCalledOnce();
});
