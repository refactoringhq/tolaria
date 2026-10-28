import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createCrossWindowPersistedStore } from "./crossWindowPersistedStore";

const STORAGE_KEY = "tolaria:ai-workspace-sessions:v1";

class BroadcastChannelTestDouble {
	static channels: BroadcastChannelTestDouble[] = [];
	static sent: unknown[] = [];
	onmessage: ((event: MessageEvent<unknown>) => void) | null = null;

	constructor(readonly name: string) {
		BroadcastChannelTestDouble.channels.push(this);
	}

	postMessage(message: unknown) {
		BroadcastChannelTestDouble.sent.push(message);
		for (const channel of BroadcastChannelTestDouble.channels) {
			if (channel === this || channel.name !== this.name) continue;
			channel.onmessage?.(new MessageEvent("message", { data: message }));
		}
	}
}

function makeDebouncedSyncStore(
	locallyChanged: Set<string>,
	broadcastDebounceMs = 1000,
) {
	return createCrossWindowPersistedStore({
		broadcastChannelName: "ai-session-sync-test",
		broadcastMessage: { type: "ai-session-updated" },
		broadcastDebounceMs,
		emptySnapshot: { chatA: "", chatB: "" },
		mergeIncomingSnapshot: (current, incoming, preserveCurrentConflicts) => {
			const merged = { ...current };
			for (const [sessionId, session] of Object.entries(incoming)) {
				if (preserveCurrentConflicts && locallyChanged.has(sessionId)) continue;
				Object.defineProperty(merged, sessionId, {
					configurable: true,
					enumerable: true,
					value: session,
					writable: true,
				});
			}
			return Object.entries(merged).every(
				([sessionId, session]) =>
					Object.getOwnPropertyDescriptor(current, sessionId)?.value ===
					session,
			)
				? current
				: merged;
		},
		onLocalSnapshotSettled: () => locallyChanged.clear(),
		persistDebounceMs: 1000,
		sanitizeStoredValue: (value: unknown) => {
			if (!value || typeof value !== "object") return { chatA: "", chatB: "" };
			return value as { chatA: string; chatB: string };
		},
		storageKey: "tolaria:test-ai-session-sync",
	});
}

describe("AI workspace transcript persistence", () => {
	let values: Map<string, string>;
	let setItem: ReturnType<typeof vi.fn>;

	beforeEach(() => {
		values = new Map();
		setItem = vi.fn((key: string, value: string) => values.set(key, value));
		vi.stubGlobal("localStorage", {
			getItem: (key: string) => values.get(key) ?? null,
			setItem,
			removeItem: (key: string) => values.delete(key),
		});
		vi.resetModules();
		vi.useFakeTimers();
		BroadcastChannelTestDouble.channels = [];
		BroadcastChannelTestDouble.sent = [];
	});

	afterEach(() => {
		vi.useRealTimers();
		vi.doUnmock("../mock-tauri");
		vi.doUnmock("@tauri-apps/api/core");
		vi.unstubAllGlobals();
	});

	it("coalesces rapid writes and flushes the latest transcript on pagehide", async () => {
		const store = await import("./aiWorkspaceSessionStore");
		const message = (response: string) => [
			{
				userMessage: "Question",
				actions: [],
				response,
				id: "message-1",
				isStreaming: true,
			},
		];

		store.setAiWorkspaceSessionMessages("chat-1", message("First"));
		store.setAiWorkspaceSessionMessages("chat-1", message("Latest"));
		expect(setItem).not.toHaveBeenCalled();
		expect(
			store.aiWorkspaceSessionSnapshot("chat-1").messages[0].response,
		).toBe("Latest");
		expect(store.aiWorkspaceSessionSnapshot("chat-1")).toBe(
			store.aiWorkspaceSessionSnapshot("chat-1"),
		);

		await vi.advanceTimersByTimeAsync(999);
		expect(setItem).not.toHaveBeenCalled();
		await vi.advanceTimersByTimeAsync(1);
		expect(setItem).toHaveBeenCalledTimes(1);
		expect(
			JSON.parse(values.get(STORAGE_KEY) ?? "{}")["chat-1"].messages[0]
				.response,
		).toBe("Latest");

		store.setAiWorkspaceSessionMessages("chat-1", message("At close"));
		window.dispatchEvent(new Event("pagehide"));
		expect(
			JSON.parse(values.get(STORAGE_KEY) ?? "{}")["chat-1"].messages[0]
				.response,
		).toBe("At close");
	});

	it("keeps the local transcript when native storage has an older session", async () => {
		const localSessions = {
			"chat-1": {
				messages: [{ id: "message-1", response: "latest local", actions: [] }],
				status: "thinking",
			},
		};
		values.set(STORAGE_KEY, JSON.stringify(localSessions));
		values.set(`${STORAGE_KEY}:flushed-on-pagehide`, "1");
		vi.doMock("../mock-tauri", () => ({ isTauri: () => true }));
		vi.doMock("@tauri-apps/api/core", () => ({
			invoke: vi.fn(async (command: string) =>
				command === "get_ai_workspace_sessions"
					? {
							"chat-1": {
								messages: [
									{ id: "message-1", response: "older native", actions: [] },
								],
								status: "thinking",
							},
							"chat-2": {
								messages: [
									{ id: "message-2", response: "native-only", actions: [] },
								],
								status: "done",
							},
						}
					: undefined,
			),
		}));

		const store = await import("./aiWorkspaceSessionStore");
		await vi.waitFor(() => {
			expect(store.aiWorkspaceSessionSnapshot("chat-2").messages).toHaveLength(
				1,
			);
		});
		expect(
			store.aiWorkspaceSessionSnapshot("chat-1").messages[0].response,
		).toBe("latest local");
		expect(
			store.aiWorkspaceSessionSnapshot("chat-2").messages[0].response,
		).toBe("native-only");
	});

	it("prefers native sessions when local storage was not flushed on close", async () => {
		values.set(
			STORAGE_KEY,
			JSON.stringify({
				"chat-1": {
					messages: [{ id: "message-1", response: "older local", actions: [] }],
					status: "thinking",
				},
			}),
		);
		vi.doMock("../mock-tauri", () => ({ isTauri: () => true }));
		vi.doMock("@tauri-apps/api/core", () => ({
			invoke: vi.fn(async (command: string) =>
				command === "get_ai_workspace_sessions"
					? {
							"chat-1": {
								messages: [
									{ id: "message-1", response: "newer native", actions: [] },
								],
								status: "thinking",
							},
						}
					: undefined,
			),
		}));

		const store = await import("./aiWorkspaceSessionStore");
		await vi.waitFor(() => {
			expect(
				store.aiWorkspaceSessionSnapshot("chat-1").messages[0].response,
			).toBe("newer native");
		});
	});

	it("keeps the close freshness hint for every window restoring the session", async () => {
		values.set(
			STORAGE_KEY,
			JSON.stringify({
				"chat-1": {
					messages: [
						{ id: "message-1", response: "latest local", actions: [] },
					],
					status: "thinking",
				},
			}),
		);
		values.set(`${STORAGE_KEY}:flushed-on-pagehide`, "1");
		vi.doMock("../mock-tauri", () => ({ isTauri: () => true }));
		vi.doMock("@tauri-apps/api/core", () => ({
			invoke: vi.fn(async (command: string) =>
				command === "get_ai_workspace_sessions"
					? {
							"chat-1": {
								messages: [
									{ id: "message-1", response: "older native", actions: [] },
								],
								status: "thinking",
							},
						}
					: undefined,
			),
		}));

		const firstWindow = await import("./aiWorkspaceSessionStore");
		await vi.waitFor(() => {
			expect(
				firstWindow.aiWorkspaceSessionSnapshot("chat-1").messages[0].response,
			).toBe("latest local");
		});
		vi.resetModules();
		const secondWindow = await import("./aiWorkspaceSessionStore");
		await vi.waitFor(() => {
			expect(
				secondWindow.aiWorkspaceSessionSnapshot("chat-1").messages[0].response,
			).toBe("latest local");
		});
		expect(values.get(`${STORAGE_KEY}:flushed-on-pagehide`)).toBe("1");
	});

	it("broadcasts pending snapshots before delayed persistence", () => {
		vi.stubGlobal("BroadcastChannel", BroadcastChannelTestDouble);
		const firstChanges = new Set<string>();
		const secondChanges = new Set<string>();
		const first = makeDebouncedSyncStore(firstChanges);
		const second = makeDebouncedSyncStore(secondChanges);
		first.ensureCrossWindowSync();
		second.ensureCrossWindowSync();

		firstChanges.add("chatA");
		first.publishSnapshot({ chatA: "updated in first", chatB: "old" });
		secondChanges.add("chatB");
		second.publishSnapshot({ chatA: "old", chatB: "updated in second" });
		expect(first.getSnapshot()).toEqual({
			chatA: "updated in first",
			chatB: "old",
		});
		expect(BroadcastChannelTestDouble.sent).toHaveLength(0);

		vi.advanceTimersByTime(999);
		expect(BroadcastChannelTestDouble.sent).toHaveLength(0);
		vi.advanceTimersByTime(1);
		expect(first.getSnapshot()).toEqual({
			chatA: "updated in first",
			chatB: "updated in second",
		});
		expect(second.getSnapshot()).toEqual({
			chatA: "updated in first",
			chatB: "updated in second",
		});
		expect(BroadcastChannelTestDouble.sent).toHaveLength(2);
		expect(
			JSON.parse(values.get("tolaria:test-ai-session-sync") ?? "{}").chatA,
		).toBe("updated in first");
		expect(
			JSON.parse(values.get("tolaria:test-ai-session-sync") ?? "{}").chatB,
		).toBe("updated in second");
	});

	it("keeps local conflict protection until persistence and broadcast settle", () => {
		vi.stubGlobal("BroadcastChannel", BroadcastChannelTestDouble);
		const localChanges = new Set<string>();
		const store = makeDebouncedSyncStore(localChanges, 1100);
		store.ensureCrossWindowSync();
		localChanges.add("chatA");
		store.publishSnapshot({ chatA: "local", chatB: "old" });

		vi.advanceTimersByTime(1000);
		expect(localChanges.has("chatA")).toBe(true);
		vi.advanceTimersByTime(100);
		expect(localChanges.has("chatA")).toBe(false);
	});

	it("accepts a causally newer edit received in the same clock millisecond", async () => {
		vi.stubGlobal("BroadcastChannel", BroadcastChannelTestDouble);
		vi.setSystemTime(new Date("2026-10-28T10:00:00.000Z"));
		const firstWindow = await import("./aiWorkspaceSessionStore");
		vi.resetModules();
		const secondWindow = await import("./aiWorkspaceSessionStore");
		const message = (response: string) => [
			{ id: "message-1", response, actions: [] },
		];

		firstWindow.setAiWorkspaceSessionMessages("chat-1", message("first"));
		await vi.advanceTimersByTimeAsync(1000);
		expect(
			secondWindow.aiWorkspaceSessionSnapshot("chat-1").messages[0].response,
		).toBe("first");

		secondWindow.setAiWorkspaceSessionMessages("chat-1", message("second"));
		await vi.advanceTimersByTimeAsync(1000);
		expect(
			firstWindow.aiWorkspaceSessionSnapshot("chat-1").messages[0].response,
		).toBe("second");
	});
});
