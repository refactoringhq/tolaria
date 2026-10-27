import {
	type Dispatch,
	type SetStateAction,
	useCallback,
	useEffect,
	useRef,
	useState,
} from "react";
import {
	type AppUpdateDownloadEvent,
	type AppUpdateMetadata,
	checkForAppUpdate,
	downloadAndInstallAppUpdate,
} from "../lib/appUpdater";
import { isTauri } from "../mock-tauri";
import { formatCalendarVersionForDisplay } from "../utils/calendarVersion";
import { openExternalUrl } from "../utils/url";

const RELEASE_NOTES_URL = "https://tolaria.md/releases/";
const UPDATER_CHECK_TIMEOUT_MS = 10_000;

function withTimeout<T>(operation: Promise<T>, timeoutMs: number): Promise<T> {
	let timeout: ReturnType<typeof setTimeout> | undefined;
	const deadline = new Promise<never>((_resolve, reject) => {
		timeout = setTimeout(
			() => reject(new Error("Update check timed out")),
			timeoutMs,
		);
	});
	return Promise.race([operation, deadline]).finally(() => {
		if (timeout) clearTimeout(timeout);
	});
}

interface UpdateVersionInfo {
	version: string;
	displayVersion: string;
}

export type UpdateStatus =
	| { state: "idle" }
	| { state: "checking" }
	| ({ state: "available"; notes: string | undefined } & UpdateVersionInfo)
	| ({ state: "downloading"; progress: number } & UpdateVersionInfo)
	| ({ state: "ready" } & UpdateVersionInfo)
	| { state: "error"; kind: "check" | "download" };

export type UpdateCheckResult =
	| { kind: "up-to-date" }
	| ({ kind: "available" } & UpdateVersionInfo)
	| { kind: "error" };

export interface UpdateActions {
	checkForUpdates: () => Promise<UpdateCheckResult>;
	startDownload: () => void;
	openReleaseNotes: () => void;
	dismiss: () => void;
}

function formatReleaseDisplayVersion(version: string): string {
	const normalizedVersion = version.trim();
	if (!normalizedVersion) return normalizedVersion;

	const baseVersion = normalizedVersion.split("+")[0];
	return formatCalendarVersionForDisplay(baseVersion) ?? baseVersion;
}

function createVersionInfo(version: string): UpdateVersionInfo {
	return {
		version,
		displayVersion: formatReleaseDisplayVersion(version),
	};
}

function toAvailableStatus(update: AppUpdateMetadata): UpdateStatus {
	return {
		state: "available",
		...createVersionInfo(update.version),
		notes: update.body ?? undefined,
	};
}

function createDownloadProgressHandler(
	versionInfo: UpdateVersionInfo,
	setStatus: Dispatch<SetStateAction<UpdateStatus>>,
): (event: AppUpdateDownloadEvent) => void {
	let totalBytes = 0;
	let downloadedBytes = 0;

	return (event) => {
		if (event.event === "Started") {
			totalBytes = event.data.contentLength ?? 0;
			return;
		}

		if (event.event === "Progress") {
			downloadedBytes += event.data.chunkLength;
			const progress =
				totalBytes > 0 ? Math.min(downloadedBytes / totalBytes, 1) : 0;
			setStatus({ state: "downloading", ...versionInfo, progress });
			return;
		}

		setStatus({ state: "ready", ...versionInfo });
	};
}

function applyUpdateCheckResult({
	checkId,
	currentCheckId,
	update,
	updateRef,
	setStatus,
}: {
	checkId: number;
	currentCheckId: number;
	update: AppUpdateMetadata | null;
	updateRef: { current: AppUpdateMetadata | null };
	setStatus: Dispatch<SetStateAction<UpdateStatus>>;
}): UpdateCheckResult {
	if (checkId !== currentCheckId) return { kind: "error" };
	if (!update) {
		updateRef.current = null;
		setStatus({ state: "idle" });
		return { kind: "up-to-date" };
	}

	const versionInfo = createVersionInfo(update.version);
	updateRef.current = update;
	setStatus(toAvailableStatus(update));
	return { kind: "available", ...versionInfo };
}

function reportUpdateCheckFailure(
	checkId: number,
	currentCheckId: number,
	setStatus: Dispatch<SetStateAction<UpdateStatus>>,
): void {
	if (checkId !== currentCheckId) return;
	console.warn("[updater] Failed to check for updates");
	setStatus({ state: "error", kind: "check" });
}

function useAutomaticUpdateCheck(
	automaticChecksEnabled: boolean,
	checkForUpdates: () => Promise<UpdateCheckResult>,
): void {
	useEffect(() => {
		if (!automaticChecksEnabled || !isTauri()) return;
		const timer = setTimeout(() => checkForUpdates(), 3000);
		return () => clearTimeout(timer);
	}, [automaticChecksEnabled, checkForUpdates]);
}

export function useUpdater(
	releaseChannel: string | null | undefined,
	automaticChecksEnabled = true,
): { status: UpdateStatus; actions: UpdateActions } {
	const [status, setStatus] = useState<UpdateStatus>({ state: "idle" });
	const updateRef = useRef<AppUpdateMetadata | null>(null);
	const checkSequence = useRef(0);

	const checkForUpdates = useCallback(async (): Promise<UpdateCheckResult> => {
		if (!isTauri()) return { kind: "up-to-date" };

		const checkId = ++checkSequence.current;
		setStatus({ state: "checking" });

		try {
			const update = await withTimeout(
				checkForAppUpdate(releaseChannel),
				UPDATER_CHECK_TIMEOUT_MS,
			);
			return applyUpdateCheckResult({
				checkId,
				currentCheckId: checkSequence.current,
				update,
				updateRef,
				setStatus,
			});
		} catch {
			reportUpdateCheckFailure(checkId, checkSequence.current, setStatus);
			return { kind: "error" };
		}
	}, [releaseChannel]);

	useAutomaticUpdateCheck(automaticChecksEnabled, checkForUpdates);

	const startDownload = useCallback(async () => {
		const update = updateRef.current;
		if (!update) return;

		const versionInfo = createVersionInfo(update.version);
		setStatus({ state: "downloading", ...versionInfo, progress: 0 });

		try {
			await downloadAndInstallAppUpdate(
				releaseChannel,
				update.version,
				createDownloadProgressHandler(versionInfo, setStatus),
			);

			// If Finished wasn't emitted via callback, set ready after await resolves
			setStatus((prev) =>
				prev.state === "downloading"
					? { state: "ready", ...versionInfo }
					: prev,
			);
		} catch {
			console.warn("[updater] Download failed");
			setStatus({ state: "error", kind: "download" });
		}
	}, [releaseChannel]);

	const openReleaseNotes = useCallback(() => {
		openExternalUrl(RELEASE_NOTES_URL);
	}, []);

	const dismiss = useCallback(() => {
		checkSequence.current += 1;
		updateRef.current = null;
		setStatus({ state: "idle" });
	}, []);

	return {
		status,
		actions: { checkForUpdates, startDownload, openReleaseNotes, dismiss },
	};
}

/**
 * Trigger app restart after an update has been downloaded.
 * Separated so the component can call it on button click.
 */
export async function restartApp(): Promise<void> {
	try {
		const { relaunch } = await import("@tauri-apps/plugin-process");
		await relaunch();
	} catch (error) {
		void error;
		console.warn("[updater] Failed to relaunch");
	}
}
