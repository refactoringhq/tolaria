export type CrossWindowStoreReadReason = "initial" | "storage";
type Listener = () => void;

interface CrossWindowPersistedStoreOptions<TSnapshot> {
	broadcastChannelName: string;
	broadcastMessage: unknown;
	emptySnapshot: TSnapshot;
	broadcastDebounceMs?: number;
	mergeIncomingSnapshot?: (
		currentSnapshot: TSnapshot,
		incomingSnapshot: TSnapshot,
		preserveCurrentConflicts: boolean,
	) => TSnapshot;
	persistDebounceMs?: number;
	onLocalSnapshotSettled?: () => void;
	sanitizeStoredValue: (
		value: unknown,
		reason: CrossWindowStoreReadReason,
	) => TSnapshot;
	storageKey: string;
}

export function createCrossWindowPersistedStore<TSnapshot>({
	broadcastChannelName,
	broadcastMessage,
	emptySnapshot,
	broadcastDebounceMs = 0,
	mergeIncomingSnapshot,
	persistDebounceMs = 0,
	onLocalSnapshotSettled,
	sanitizeStoredValue,
	storageKey,
}: CrossWindowPersistedStoreOptions<TSnapshot>) {
	let snapshot = readStoredSnapshot("initial");
	let broadcastChannel: BroadcastChannel | null = null;
	let broadcastTimer: ReturnType<typeof setTimeout> | null = null;
	let persistTimer: ReturnType<typeof setTimeout> | null = null;
	const listeners = new Set<Listener>();
	function notifyLocalSnapshotSettledIfReady(): void {
		if (!persistTimer && !broadcastTimer) onLocalSnapshotSettled?.();
	}
	function readStoredSnapshot(
		reason: CrossWindowStoreReadReason = "initial",
	): TSnapshot {
		if (typeof localStorage === "undefined") return emptySnapshot;

		try {
			return sanitizeStoredValue(
				JSON.parse(localStorage.getItem(storageKey) ?? "{}"),
				reason,
			);
		} catch {
			return emptySnapshot;
		}
	}

	function writeStoredSnapshot(nextSnapshot = snapshot): boolean {
		if (typeof localStorage === "undefined") return false;

		try {
			localStorage.setItem(storageKey, JSON.stringify(nextSnapshot));
			return true;
		} catch {
			// Cross-window localStorage is a best-effort cache; callers may have a durable backend.
			return false;
		}
	}

	function scheduleStoredSnapshotWrite(): void {
		if (persistDebounceMs <= 0) {
			writeStoredSnapshot();
			return;
		}
		if (persistTimer) return;
		persistTimer = setTimeout(() => {
			persistTimer = null;
			writeStoredSnapshot();
			notifyLocalSnapshotSettledIfReady();
		}, persistDebounceMs);
	}

	function flushStoredSnapshot(): boolean {
		if (persistTimer) clearTimeout(persistTimer);
		persistTimer = null;
		const written = writeStoredSnapshot();
		notifyLocalSnapshotSettledIfReady();
		return written;
	}

	function notifyListeners(): void {
		for (const listener of listeners) listener();
	}

	function broadcastSnapshot(nextSnapshot: TSnapshot): void {
		if (typeof BroadcastChannel === "undefined") return;

		broadcastChannel ??= new BroadcastChannel(broadcastChannelName);
		const message =
			typeof broadcastMessage === "object" &&
			broadcastMessage !== null &&
			!Array.isArray(broadcastMessage)
				? { ...broadcastMessage, snapshot: nextSnapshot }
				: { message: broadcastMessage, snapshot: nextSnapshot };
		broadcastChannel.postMessage(message);
	}

	function scheduleBroadcastSnapshot(): void {
		if (broadcastDebounceMs <= 0) {
			broadcastSnapshot(snapshot);
			return;
		}
		if (broadcastTimer) return;
		broadcastTimer = setTimeout(() => {
			broadcastTimer = null;
			broadcastSnapshot(snapshot);
			notifyLocalSnapshotSettledIfReady();
		}, broadcastDebounceMs);
	}

	function flushBroadcastSnapshot(): void {
		if (broadcastTimer) clearTimeout(broadcastTimer);
		broadcastTimer = null;
		broadcastSnapshot(snapshot);
		notifyLocalSnapshotSettledIfReady();
	}

	function replaceSnapshot(nextSnapshot: TSnapshot): void {
		snapshot = nextSnapshot;
		notifyListeners();
	}

	function receiveSnapshot(nextSnapshot: TSnapshot): void {
		if (!mergeIncomingSnapshot) {
			replaceSnapshot(nextSnapshot);
			return;
		}

		const mergedSnapshot = mergeIncomingSnapshot(
			snapshot,
			nextSnapshot,
			Boolean(persistTimer || broadcastTimer),
		);
		if (mergedSnapshot === snapshot) return;

		snapshot = mergedSnapshot;
		scheduleStoredSnapshotWrite();
		scheduleBroadcastSnapshot();
		notifyListeners();
	}

	function publishSnapshot(nextSnapshot: TSnapshot): void {
		snapshot = nextSnapshot;
		scheduleStoredSnapshotWrite();
		scheduleBroadcastSnapshot();
		notifyListeners();
	}

	function syncFromStorage(): void {
		receiveSnapshot(readStoredSnapshot("storage"));
	}

	function syncFromBroadcast(event: MessageEvent<unknown>): void {
		const data = event.data;
		if (!data || typeof data !== "object") {
			syncFromStorage();
			return;
		}
		if (!Object.hasOwn(data, "snapshot")) {
			syncFromStorage();
			return;
		}

		const message = data as { snapshot: unknown };
		receiveSnapshot(sanitizeStoredValue(message.snapshot, "storage"));
	}

	function ensureCrossWindowSync(): void {
		if (typeof window === "undefined") return;
		if (persistDebounceMs > 0) {
			window.addEventListener("pagehide", () => {
				flushStoredSnapshot();
				flushBroadcastSnapshot();
			});
		}
		window.addEventListener("storage", (event) => {
			if (event.key === storageKey) syncFromStorage();
		});

		if (typeof BroadcastChannel === "undefined") return;
		broadcastChannel ??= new BroadcastChannel(broadcastChannelName);
		broadcastChannel.onmessage = syncFromBroadcast;
	}

	return {
		ensureCrossWindowSync,
		getSnapshot: () => snapshot,
		publishSnapshot,
		replaceSnapshot,
		subscribe(listener: Listener): () => void {
			listeners.add(listener);
			return () => listeners.delete(listener);
		},
		writeStoredSnapshot,
		flushStoredSnapshot,
		flushBroadcastSnapshot,
	};
}
