import { afterEach, beforeEach, expect, it, vi } from "vitest";

const probe = vi.hoisted(() => ({
	launchSearch: "",
	enabled: true,
	initialUrl: vi.fn<() => Promise<string | null>>(),
	run: vi.fn(),
	runBackground: vi.fn(),
	files: new Map<string, string>(),
	remove: vi.fn(),
	cleanup: undefined as (() => void) | undefined,
}));

vi.mock("react", () => ({
	useEffect: (effect: () => (() => void) | undefined) => {
		probe.cleanup = effect();
	},
}));
vi.mock("react-native", () => ({
	Linking: {
		getInitialURL: probe.initialUrl,
		addEventListener: () => ({ remove: probe.remove }),
	},
}));
vi.mock("expo", () => ({
	requireOptionalNativeModule: () => ({
		nativeStorageQAEnabled: probe.enabled,
	}),
}));
vi.mock("expo-file-system", () => ({
	Paths: { document: "documents" },
	File: class MockFile {
		path: string;
		constructor(...parts: string[]) {
			this.path = parts.join("/");
		}
		get exists() {
			return probe.files.has(this.path);
		}
		async text() {
			return probe.files.get(this.path) ?? "";
		}
		write(value: string) {
			probe.files.set(this.path, value);
		}
		delete() {
			probe.files.delete(this.path);
		}
	},
}));
vi.mock("../native/mobileNativeKeyCommands", () => ({
	nativeMobileLaunchSearch: () => probe.launchSearch,
}));
vi.mock("./runNativeGitProbe", () => ({ runNativeGitProbe: probe.run }));
vi.mock("./nativeBackgroundSyncProbe", () => ({
	runNativeBackgroundSyncProbe: probe.runBackground,
}));

import { useNativeGitProbe } from "./nativeGitProbe.native";

beforeEach(() => {
	vi.stubGlobal("__DEV__", false);
	probe.enabled = true;
	probe.launchSearch = "";
	probe.files.clear();
	probe.runBackground.mockResolvedValue({ passed: true });
	probe.cleanup = undefined;
	probe.initialUrl.mockResolvedValue(null);
});

afterEach(() => {
	probe.cleanup?.();
	vi.clearAllMocks();
	vi.unstubAllGlobals();
});

it("starts an optimized native probe from explicit simulator launch arguments", async () => {
	probe.launchSearch =
		"?source=fixture&gitProbe=http%3A%2F%2F127.0.0.1%3A43210";
	useNativeGitProbe();
	await vi.waitFor(() =>
		expect(probe.run).toHaveBeenCalledWith("http://127.0.0.1:43210"),
	);
	expect(probe.initialUrl).not.toHaveBeenCalled();
});

it("retains deep-link startup when no explicit launch search is present", async () => {
	probe.initialUrl.mockResolvedValue(
		"tolaria:///?gitProbe=http%3A%2F%2F127.0.0.1%3A43210",
	);
	useNativeGitProbe();
	await vi.waitFor(() =>
		expect(probe.run).toHaveBeenCalledWith("http://127.0.0.1:43210"),
	);
});

it("does not authorize a production binary through simulator arguments", () => {
	probe.enabled = false;
	probe.launchSearch = "?gitProbe=http%3A%2F%2F127.0.0.1%3A43210";
	useNativeGitProbe();
	expect(probe.run).not.toHaveBeenCalled();
	expect(probe.initialUrl).not.toHaveBeenCalled();
});

it("rejects non-loopback probe endpoints in simulator arguments", async () => {
	probe.launchSearch = "?gitProbe=https%3A%2F%2Fexample.com%2F";
	useNativeGitProbe();
	await Promise.resolve();
	expect(probe.run).not.toHaveBeenCalled();
});

it("runs a debug-only background probe from a container trigger and persists its proof", async () => {
	vi.stubGlobal("__DEV__", true);
	const expected = { passed: true, state: "background" };
	probe.files.set(
		"documents/qa/tol75.json",
		JSON.stringify({ endpoint: "http://127.0.0.1:43210/" }),
	);
	probe.runBackground.mockResolvedValue(expected);
	probe.runBackground.mockImplementation(async (_endpoint, persistProof) => {
		persistProof(expected);
		return expected;
	});

	useNativeGitProbe();

	await vi.waitFor(() => expect(probe.runBackground).toHaveBeenCalled());
	await vi.waitFor(() =>
		expect(probe.files.get("documents/qa/tol75-proof.json")).toBe(
			JSON.stringify(expected, null, 2),
		),
	);
	expect(probe.runBackground).toHaveBeenCalledWith(
		"http://127.0.0.1:43210/",
		expect.any(Function),
	);
	expect(probe.files.has("documents/qa/tol75.json")).toBe(false);
});

it("never reads or runs a container trigger in a non-debug build", () => {
	probe.files.set(
		"documents/qa/tol75.json",
		JSON.stringify({ endpoint: "http://127.0.0.1:43210/" }),
	);

	useNativeGitProbe();

	expect(probe.runBackground).not.toHaveBeenCalled();
	expect(probe.files.has("documents/qa/tol75-proof.json")).toBe(false);
	expect(probe.files.has("documents/qa/tol75.json")).toBe(true);
});
