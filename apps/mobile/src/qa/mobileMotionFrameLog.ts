export const mobileMotionFrameProbeEnabled =
	typeof __DEV__ !== "undefined" &&
	__DEV__ &&
	process.env.EXPO_PUBLIC_TOLARIA_MOTION_FRAME_PROBE === "1";

export function logMobileMotionEvent(
	event: string,
	details: Record<string, number | string | boolean | null>,
) {
	if (!mobileMotionFrameProbeEnabled) return;
	console.info(
		`TOLARIA_MOTION_EVENT ${JSON.stringify({ buildId: motionBuildId(), event, at: monotonicNow(), ...details })}`,
	);
}

export function logMobileMotionBodyRender(
	compact: boolean,
	{
		noteId,
		rawContent,
		render,
		changedInputs,
	}: {
		noteId: string;
		rawContent: string | undefined;
		render: number;
		changedInputs: string[];
	},
) {
	if (!compact) return;
	logMobileMotionEvent("note-body-render", {
		contentFingerprint: motionContentFingerprint(rawContent),
		contentLength: rawContent?.length ?? 0,
		noteId,
		render,
		changedInputs: changedInputs.join(","),
	});
}

export function motionContentFingerprint(value: string | undefined) {
	if (value === undefined) return null;
	let hash = 2166136261;
	for (let index = 0; index < value.length; index += 1) {
		hash = Math.imul(hash ^ value.charCodeAt(index), 16777619);
	}
	return (hash >>> 0).toString(16);
}

function monotonicNow() {
	return globalThis.performance?.now?.() ?? Date.now();
}

function motionBuildId() {
	return (
		process.env.EXPO_PUBLIC_TOLARIA_MOTION_BUILD_ID ?? "unlabeled-dev-build"
	);
}
