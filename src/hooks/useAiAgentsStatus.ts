import { invoke } from "@tauri-apps/api/core";
import { useEffect, useState } from "react";
import {
	type AiAgentId,
	type AiAgentsStatus,
	createCheckingAiAgentsStatus,
	normalizeAiAgentsStatus,
} from "../lib/aiAgents";
import { isTauri, mockInvoke } from "../mock-tauri";

type RawAiAgentsStatus = Partial<
	Record<AiAgentId, { installed?: boolean | null; version?: string | null }>
>;

export const AI_AGENTS_STATUS_PROBE_TIMEOUT_MS = 20000;
export const AI_AGENTS_STATUS_RETRY_INTERVAL_MS = 30000;

interface UseAiAgentsStatusOptions {
	/**
	 * When false, the hook stays in its initial state and never calls the
	 * Tauri probe. Used to skip the ~1 s discovery cost when AI features are
	 * disabled or in lightweight window routes that never render agent-aware UI.
	 *
	 * Defaults to true to preserve existing behaviour for callers that pass
	 * no options.
	 */
	enabled?: boolean;
}

type IdleHandle =
	| { kind: "idle"; id: number }
	| { kind: "timeout"; id: ReturnType<typeof setTimeout> };

function tauriCall<T>(command: string): Promise<T> {
	return isTauri() ? invoke<T>(command) : mockInvoke<T>(command);
}

function scheduleIdle(callback: () => void): IdleHandle {
	const requestIdle =
		typeof window !== "undefined"
			? window.requestIdleCallback?.bind(window)
			: undefined;
	if (typeof requestIdle === "function") {
		return { kind: "idle", id: requestIdle(callback) };
	}
	return { kind: "timeout", id: setTimeout(callback, 0) };
}

function cancelIdle(handle: IdleHandle): void {
	if (handle.kind === "idle") {
		const cancelIdleFn =
			typeof window !== "undefined"
				? window.cancelIdleCallback?.bind(window)
				: undefined;
		if (typeof cancelIdleFn === "function") {
			cancelIdleFn(handle.id);
		}
		return;
	}

	clearTimeout(handle.id);
}

function allAgentsMissing(statuses: AiAgentsStatus): boolean {
	return Object.values(statuses).every((status) => status.status === "missing");
}

interface ApplyProbeResultOptions {
	result: RawAiAgentsStatus;
	attempt: number;
	latestAttempt: number;
	cancelled: boolean;
	timeoutId: ReturnType<typeof setTimeout>;
	timeoutIds: Set<ReturnType<typeof setTimeout>>;
	onStatus: (statuses: AiAgentsStatus) => void;
	onRetry: () => void;
}

function applyProbeResult(options: ApplyProbeResultOptions): void {
	const {
		result,
		attempt,
		latestAttempt,
		cancelled,
		timeoutId,
		timeoutIds,
		onStatus,
		onRetry,
	} = options;
	clearTimeout(timeoutId);
	timeoutIds.delete(timeoutId);
	if (cancelled || attempt !== latestAttempt) return;

	const normalized = normalizeAiAgentsStatus(result);
	onStatus(normalized);
	if (allAgentsMissing(normalized)) onRetry();
}

export function useAiAgentsStatus(
	options?: UseAiAgentsStatusOptions,
): AiAgentsStatus {
	const enabled = options?.enabled ?? true;
	const [statuses, setStatuses] = useState<AiAgentsStatus>(
		createCheckingAiAgentsStatus(),
	);

	useEffect(() => {
		if (!enabled) {
			// Skip the probe entirely. Status is intentionally NOT reset — last-known
			// results stay in memory across enabled/disabled toggles so that a brief
			// disable does not blank out the badge.
			return;
		}

		let cancelled = false;
		const timeoutIds = new Set<ReturnType<typeof setTimeout>>();
		let latestAttempt = 0;
		let retriedAllMissing = false;

		const fire = () => {
			if (cancelled) return;

			const attempt = ++latestAttempt;
			const timeoutId = setTimeout(() => {
				timeoutIds.delete(timeoutId);
				if (!cancelled && attempt === latestAttempt) fire();
			}, AI_AGENTS_STATUS_PROBE_TIMEOUT_MS);
			timeoutIds.add(timeoutId);

			tauriCall<RawAiAgentsStatus>("get_ai_agents_status")
				.then((result) => {
					applyProbeResult({
						result,
						attempt,
						latestAttempt,
						cancelled,
						timeoutId,
						timeoutIds,
						onStatus: setStatuses,
						onRetry: () => {
							if (retriedAllMissing) return;
							retriedAllMissing = true;
							const retryId = setTimeout(() => {
								timeoutIds.delete(retryId);
								if (!cancelled && attempt === latestAttempt) fire();
							}, AI_AGENTS_STATUS_RETRY_INTERVAL_MS);
							timeoutIds.add(retryId);
						},
					});
				})
				.catch(() => {
					// Keep the timeout armed so a transient IPC failure gets another probe.
				});
		};

		// Defer the probe so it does not run on the cold-start critical path.
		// requestIdleCallback is unavailable in WKWebView (Tauri's macOS web view),
		// so fall back to setTimeout(0).
		const handle = scheduleIdle(fire);

		return () => {
			cancelled = true;
			timeoutIds.forEach(clearTimeout);
			timeoutIds.clear();
			cancelIdle(handle);
		};
	}, [enabled]);

	return statuses;
}
