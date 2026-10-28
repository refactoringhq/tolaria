import { invoke } from "@tauri-apps/api/core";
import type { Dispatch, SetStateAction } from "react";
import { isTauri } from "../mock-tauri";
import type { AgentStatus, AiAgentMessage } from "./aiAgentConversation";
import {
	type CrossWindowStoreReadReason,
	createCrossWindowPersistedStore,
} from "./crossWindowPersistedStore";

const STORAGE_KEY = "tolaria:ai-workspace-sessions:v1";
const LOCAL_SNAPSHOT_FLUSHED_KEY = `${STORAGE_KEY}:flushed-on-pagehide`;
const BROADCAST_CHANNEL = "tolaria-ai-workspace-sessions";
const NATIVE_WRITE_DEBOUNCE_MS = 250;
const LOCAL_STORAGE_WRITE_DEBOUNCE_MS = 1000;
const locallyUpdatedSessionIds = new Set<SessionId>();

export interface AiWorkspaceSessionSnapshot {
	messages: AiAgentMessage[];
	status: AgentStatus;
}

interface StoredAiWorkspaceSessionSnapshot extends AiWorkspaceSessionSnapshot {
	revision?: string;
}

type MessageId = string;
type SessionId = string;
type SessionMap = Record<SessionId, StoredAiWorkspaceSessionSnapshot>;
const sessionWriterId = crypto.randomUUID();
let lastSessionRevision = 0;
const publicSessionSnapshots = new Map<
	SessionId,
	{
		source: StoredAiWorkspaceSessionSnapshot;
		snapshot: AiWorkspaceSessionSnapshot;
	}
>();

function mergeIncomingSessions(
	current: SessionMap,
	incoming: SessionMap,
	preserveCurrentConflicts: boolean,
): SessionMap {
	let merged = current;
	for (const [sessionId, session] of Object.entries(incoming)) {
		lastSessionRevision = Math.max(
			lastSessionRevision,
			revisionTime(session.revision),
		);
		if (
			shouldKeepCurrentSession(
				getSession(current, sessionId),
				session,
				sessionId,
				preserveCurrentConflicts,
			)
		)
			continue;
		if (merged === current) merged = { ...current };
		Object.defineProperty(merged, sessionId, {
			configurable: true,
			enumerable: true,
			value: session,
			writable: true,
		});
	}
	return merged;
}

function getSession(
	sessions: SessionMap,
	sessionId: SessionId,
): StoredAiWorkspaceSessionSnapshot | undefined {
	return Object.getOwnPropertyDescriptor(sessions, sessionId)?.value;
}

function shouldKeepCurrentSession(
	current: StoredAiWorkspaceSessionSnapshot | undefined,
	incoming: StoredAiWorkspaceSessionSnapshot,
	sessionId: SessionId,
	preserveCurrentConflicts: boolean,
): boolean {
	return (
		preserveLocalSession(sessionId, preserveCurrentConflicts) ||
		incomingHasOlderRevision(current, incoming) ||
		sessionSnapshotsMatch(current, incoming)
	);
}

function preserveLocalSession(
	sessionId: SessionId,
	preserveCurrentConflicts: boolean,
): boolean {
	return preserveCurrentConflicts && locallyUpdatedSessionIds.has(sessionId);
}

function incomingHasOlderRevision(
	current: StoredAiWorkspaceSessionSnapshot | undefined,
	incoming: StoredAiWorkspaceSessionSnapshot,
): boolean {
	if (!current?.revision || !incoming.revision) return false;
	return current.revision > incoming.revision;
}

function sessionSnapshotsMatch(
	current: StoredAiWorkspaceSessionSnapshot | undefined,
	incoming: StoredAiWorkspaceSessionSnapshot,
): boolean {
	if (!current) return false;
	return JSON.stringify(current) === JSON.stringify(incoming);
}

function revisionTime(revision?: string): number {
	const separator = revision?.indexOf(":") ?? -1;
	if (separator < 0) return 0;
	const timestamp = Number(revision?.slice(0, separator));
	return Number.isSafeInteger(timestamp) ? timestamp : 0;
}

const EMPTY_SESSION: AiWorkspaceSessionSnapshot = {
	messages: [],
	status: "idle",
};

const sessionStore = createCrossWindowPersistedStore<SessionMap>({
	broadcastChannelName: BROADCAST_CHANNEL,
	broadcastMessage: { type: "ai-workspace-sessions-updated" },
	broadcastDebounceMs: LOCAL_STORAGE_WRITE_DEBOUNCE_MS,
	emptySnapshot: {},
	mergeIncomingSnapshot: mergeIncomingSessions,
	onLocalSnapshotSettled: () => locallyUpdatedSessionIds.clear(),
	persistDebounceMs: LOCAL_STORAGE_WRITE_DEBOUNCE_MS,
	sanitizeStoredValue: normalizeStoredSessionsForReason,
	storageKey: STORAGE_KEY,
});
function wasLocalSnapshotFlushedOnPagehide(): boolean {
	try {
		return localStorage.getItem(LOCAL_SNAPSHOT_FLUSHED_KEY) === "1";
	} catch {
		return false;
	}
}
let storeVersion = 0;
let nativeWriteTimer: ReturnType<typeof setTimeout> | null = null;
let nativeWriteInFlight = false;
let pendingNativeSessions: SessionMap | null = null;

function isSessionSnapshot(
	value: unknown,
): value is StoredAiWorkspaceSessionSnapshot {
	if (!value || typeof value !== "object") return false;
	const candidate = value as Partial<AiWorkspaceSessionSnapshot>;
	return (
		Array.isArray(candidate.messages) && typeof candidate.status === "string"
	);
}

function isStoredSessionEntry(
	entry: [string, unknown],
): entry is [string, StoredAiWorkspaceSessionSnapshot] {
	if (typeof entry[0] !== "string") return false;
	return isSessionSnapshot(entry[1]);
}

function normalizeStoredStatus(
	value: unknown,
	resetRunningStatus: boolean,
): AgentStatus {
	switch (value) {
		case "idle":
		case "done":
		case "error":
			return value;
		case "thinking":
		case "tool-executing":
			return resetRunningStatus ? "idle" : value;
		default:
			return "idle";
	}
}

function normalizeStoredMessages(
	messages: AiAgentMessage[],
	resetRunningStatus: boolean,
): AiAgentMessage[] {
	if (!resetRunningStatus) return messages;
	return messages.map((message) =>
		message.isStreaming ? { ...message, isStreaming: false } : message,
	);
}

function normalizeStoredSessions(
	value: unknown,
	resetRunningStatus: boolean,
): SessionMap {
	if (!value) return {};
	if (typeof value !== "object") return {};
	if (Array.isArray(value)) return {};

	return Object.fromEntries(
		Object.entries(value)
			.filter(isStoredSessionEntry)
			.map(([sessionId, session]) => [
				sessionId,
				{
					messages: normalizeStoredMessages(
						session.messages,
						resetRunningStatus,
					),
					status: normalizeStoredStatus(session.status, resetRunningStatus),
					...(typeof session.revision === "string"
						? { revision: session.revision }
						: {}),
				},
			]),
	);
}

function normalizeStoredSessionsForReason(
	value: unknown,
	reason: CrossWindowStoreReadReason,
): SessionMap {
	return normalizeStoredSessions(value, reason !== "storage");
}

async function readNativeSessions(): Promise<SessionMap> {
	if (!isTauri()) return {};

	try {
		const stored = await invoke<unknown>("get_ai_workspace_sessions");
		return normalizeStoredSessions(stored, true);
	} catch {
		return {};
	}
}

async function flushNativeSessionsWrite(): Promise<void> {
	if (!isTauri()) return;
	if (nativeWriteInFlight) return;
	if (!pendingNativeSessions) return;

	nativeWriteInFlight = true;
	const nextSessions = pendingNativeSessions;
	pendingNativeSessions = null;
	nativeWriteTimer = null;

	try {
		await invoke("save_ai_workspace_sessions", { sessions: nextSessions });
	} catch {
		// Transcript persistence should never interrupt the chat UI.
	} finally {
		nativeWriteInFlight = false;
		if (pendingNativeSessions)
			scheduleNativeSessionsWrite(pendingNativeSessions);
	}
}

function scheduleNativeSessionsWrite(nextSessions: SessionMap): void {
	if (!isTauri()) return;

	pendingNativeSessions = nextSessions;
	if (nativeWriteTimer || nativeWriteInFlight) return;

	nativeWriteTimer = setTimeout(() => {
		void flushNativeSessionsWrite();
	}, NATIVE_WRITE_DEBOUNCE_MS);
}

function publishSessions(nextSessions: SessionMap): void {
	const currentSessions = sessionStore.getSnapshot();
	let versionedSessions = nextSessions;
	for (const sessionId of new Set([
		...Object.keys(currentSessions),
		...Object.keys(nextSessions),
	])) {
		const nextSession = getSession(nextSessions, sessionId);
		if (getSession(currentSessions, sessionId) !== nextSession) {
			locallyUpdatedSessionIds.add(sessionId);
			const revisionTime = Math.max(Date.now(), lastSessionRevision + 1);
			lastSessionRevision = revisionTime;
			const nextVersionedSession = {
				...nextSession,
				revision: `${String(revisionTime).padStart(16, "0")}:${sessionWriterId}`,
			};
			versionedSessions = { ...versionedSessions };
			Object.defineProperty(versionedSessions, sessionId, {
				configurable: true,
				enumerable: true,
				value: nextVersionedSession,
				writable: true,
			});
		}
	}
	storeVersion += 1;
	try {
		localStorage.removeItem(LOCAL_SNAPSHOT_FLUSHED_KEY);
	} catch {
		// The marker is only a startup hint; session persistence continues without it.
	}
	sessionStore.publishSnapshot(versionedSessions);
	scheduleNativeSessionsWrite(versionedSessions);
}

function publishSessionUpdate(
	sessionId: SessionId,
	update: (current: AiWorkspaceSessionSnapshot) => AiWorkspaceSessionSnapshot,
): void {
	const current = aiWorkspaceSessionSnapshot(sessionId);
	publishSessions({
		...sessionStore.getSnapshot(),
		[sessionId]: update(current),
	});
}

async function syncFromNativeStorage(): Promise<void> {
	const loadVersion = storeVersion;
	const nativeSessions = await readNativeSessions();
	if (storeVersion !== loadVersion) return;
	const currentSessions = sessionStore.getSnapshot();
	if (Object.keys(nativeSessions).length === 0) {
		if (Object.keys(currentSessions).length > 0)
			scheduleNativeSessionsWrite(currentSessions);
		return;
	}

	// Native saves normally finish before the debounced browser cache. On a
	// normal close, pagehide marks the cache as synchronously flushed so it can
	// win if a native save was still in flight.
	const mergedSessions = wasLocalSnapshotFlushedOnPagehide()
		? { ...nativeSessions, ...currentSessions }
		: { ...currentSessions, ...nativeSessions };
	sessionStore.publishSnapshot(mergedSessions);
	sessionStore.writeStoredSnapshot(mergedSessions);
}

function ensureSessionStoreSync(): void {
	if (typeof window === "undefined") return;

	sessionStore.ensureCrossWindowSync();
	window.addEventListener("pagehide", () => {
		if (nativeWriteTimer) clearTimeout(nativeWriteTimer);
		nativeWriteTimer = null;
		try {
			if (sessionStore.flushStoredSnapshot())
				localStorage.setItem(LOCAL_SNAPSHOT_FLUSHED_KEY, "1");
		} catch {
			// The native store remains the recovery source if local storage is unavailable.
		}
		void flushNativeSessionsWrite();
	});
}

ensureSessionStoreSync();
void syncFromNativeStorage();

export function aiWorkspaceSessionSnapshot(
	sessionId: SessionId,
): AiWorkspaceSessionSnapshot {
	const source =
		getSession(sessionStore.getSnapshot(), sessionId) ?? EMPTY_SESSION;
	const cached = publicSessionSnapshots.get(sessionId);
	if (cached?.source === source) return cached.snapshot;
	const snapshot = { messages: source.messages, status: source.status };
	publicSessionSnapshots.set(sessionId, { source, snapshot });
	return snapshot;
}

export function subscribeAiWorkspaceSession(
	_sessionId: SessionId,
	listener: () => void,
): () => void {
	return sessionStore.subscribe(listener);
}

export function setAiWorkspaceSessionMessages(
	sessionId: SessionId,
	next: SetStateAction<AiAgentMessage[]>,
): void {
	publishSessionUpdate(sessionId, (current) => {
		const messages = typeof next === "function" ? next(current.messages) : next;
		return {
			...current,
			messages,
		};
	});
}

export function setAiWorkspaceSessionStatus(
	sessionId: SessionId,
	next: SetStateAction<AgentStatus>,
): void {
	publishSessionUpdate(sessionId, (current) => {
		const status = typeof next === "function" ? next(current.status) : next;
		return {
			...current,
			status,
		};
	});
}

export function resetAiWorkspaceSession(sessionId: SessionId): void {
	publishSessions({
		...sessionStore.getSnapshot(),
		[sessionId]: EMPTY_SESSION,
	});
}

export function cloneAiWorkspaceSessionUntilMessage(
	sourceSessionId: SessionId,
	targetSessionId: SessionId,
	messageId: MessageId,
): void {
	const source = aiWorkspaceSessionSnapshot(sourceSessionId);
	const messageIndex = source.messages.findIndex(
		(message) => message.id === messageId,
	);
	const messages =
		messageIndex >= 0
			? source.messages.slice(0, messageIndex + 1)
			: source.messages;
	publishSessions({
		...sessionStore.getSnapshot(),
		[targetSessionId]: {
			messages: messages.map((message) => ({ ...message, isStreaming: false })),
			status: "idle",
		},
	});
}

export function aiWorkspaceSessionDispatchers(sessionId: SessionId): {
	setMessages: Dispatch<SetStateAction<AiAgentMessage[]>>;
	setStatus: Dispatch<SetStateAction<AgentStatus>>;
} {
	return {
		setMessages: (next) => setAiWorkspaceSessionMessages(sessionId, next),
		setStatus: (next) => setAiWorkspaceSessionStatus(sessionId, next),
	};
}

export function resetAiWorkspaceSessionStoreForTests(): void {
	storeVersion = 0;
	lastSessionRevision = 0;
	locallyUpdatedSessionIds.clear();
	publicSessionSnapshots.clear();
	pendingNativeSessions = null;
	if (nativeWriteTimer) clearTimeout(nativeWriteTimer);
	nativeWriteTimer = null;
	nativeWriteInFlight = false;
	sessionStore.publishSnapshot({});
}
