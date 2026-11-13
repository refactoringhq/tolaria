import {
	type default as Animated,
	type AnimatedRef,
	makeMutable,
	measure,
	runOnJS,
	type SharedValue,
	useFrameCallback,
	useSharedValue,
} from "react-native-reanimated";
import { mobileMotionFrameProbeEnabled } from "./mobileMotionFrameLog";

export { mobileMotionFrameProbeEnabled } from "./mobileMotionFrameLog";

export const mobileMotionGeometryCaptureActive = makeMutable(false);

export function useMobileMotionFrameProbe(
	id: string,
	value: SharedValue<number>,
	enabled = mobileMotionFrameProbeEnabled,
) {
	const previous = useSharedValue(Number.NaN);
	const active = useSharedValue(false);
	const idleFrames = useSharedValue(0);
	const direction = useSharedValue(0);
	const maxReverseDelta = useSharedValue(0);
	const sampleCount = useSharedValue(0);
	useFrameCallback((frame) => {
		"worklet";
		const current = value.get();
		const last = previous.get();
		const wasActive = active.get();
		const changed = updateMotionSummary({
			current,
			direction,
			last,
			maxReverseDelta,
			sampleCount,
			wasActive,
		});
		const initialized = Number.isFinite(last);
		const idleCount = changed || !wasActive ? 0 : idleFrames.get() + 1;
		const moving = shouldLogFrame({
			changed,
			enabled,
			idleCount,
			initialized,
			wasActive,
		});
		idleFrames.set(idleCount);
		active.set(moving);
		if (wasActive && !moving)
			runOnJS(logMobileMotionFrameSummary)(
				id,
				maxReverseDelta.get(),
				sampleCount.get(),
			);
		if (moving)
			runOnJS(logMobileMotionFrame)(
				id,
				frame.timestamp,
				frame.timeSincePreviousFrame ?? 0,
				current,
			);
		previous.set(current);
	}, enabled);
}

export function useMobileMotionGeometryProbe(
	id: string,
	ref: AnimatedRef<Animated.View>,
	rowHeight: SharedValue<number> | undefined,
	enabled = mobileMotionFrameProbeEnabled && Boolean(id),
) {
	const previous = useSharedValue({
		x: Number.NaN,
		y: Number.NaN,
		width: 0,
		height: 0,
	});
	useFrameCallback((frame) => {
		"worklet";
		if (
			!geometryCaptureReady({
				enabled,
				captureActive: mobileMotionGeometryCaptureActive.get(),
				rowHeight: rowHeight?.get() ?? 0,
			})
		)
			return;
		const measured = measure(ref);
		if (!measured) return;
		const last = previous.get();
		if (!geometryChanged(measured, last)) return;
		previous.set({
			x: measured.pageX,
			y: measured.pageY,
			width: measured.width,
			height: measured.height,
		});
		runOnJS(logMobileMotionGeometry)({
			noteId: id,
			at: frame.timestamp,
			x: measured.pageX,
			y: measured.pageY,
			width: measured.width,
			height: measured.height,
		});
	}, enabled && Boolean(id));
}

function geometryCaptureReady({
	enabled,
	captureActive,
	rowHeight,
}: {
	enabled: boolean;
	captureActive: boolean;
	rowHeight: number;
}) {
	"worklet";
	return enabled && captureActive && rowHeight > 0;
}

function geometryChanged(
	measured: { pageX: number; pageY: number; width: number; height: number },
	previous: { x: number; y: number; width: number; height: number },
) {
	"worklet";
	return (
		Math.abs(measured.pageX - previous.x) > 0.25 ||
		Math.abs(measured.pageY - previous.y) > 0.25 ||
		Math.abs(measured.width - previous.width) > 0.25 ||
		Math.abs(measured.height - previous.height) > 0.25
	);
}

export function stopMobileMotionGeometryCapture() {
	setTimeout(() => mobileMotionGeometryCaptureActive.set(false), 120);
}

function updateMotionSummary({
	current,
	direction,
	last,
	maxReverseDelta,
	sampleCount,
	wasActive,
}: {
	current: number;
	direction: SharedValue<number>;
	last: number;
	maxReverseDelta: SharedValue<number>;
	sampleCount: SharedValue<number>;
	wasActive: boolean;
}) {
	"worklet";
	const delta = Number.isFinite(last) ? current - last : 0;
	const changed = Number.isFinite(last) && Math.abs(current - last) > 0.01;
	const sample = Number(Number.isFinite(last)) * Number(changed);
	const motionDirection =
		direction.get() * Number(wasActive) || Math.sign(delta);
	direction.set(motionDirection);
	maxReverseDelta.set(
		maxReverseDelta.get() * Number(wasActive) +
			Math.max(0, -delta * motionDirection) * sample,
	);
	sampleCount.set(sampleCount.get() * Number(wasActive) + sample);
	return changed;
}

function logMobileMotionFrameSummary(
	id: string,
	maxReverseDelta: number,
	sampleCount: number,
) {
	console.info(
		`TOLARIA_MOTION_EVENT ${JSON.stringify({ buildId: process.env.EXPO_PUBLIC_TOLARIA_MOTION_BUILD_ID ?? "unlabeled-dev-build", event: "motion-frame-summary", id, maxReverseDelta, sampleCount, at: globalThis.performance?.now?.() ?? Date.now() })}`,
	);
}

function logMobileMotionGeometry(frame: {
	noteId: string;
	at: number;
	x: number;
	y: number;
	width: number;
	height: number;
}) {
	console.info(
		`TOLARIA_MOTION_EVENT ${JSON.stringify({ buildId: process.env.EXPO_PUBLIC_TOLARIA_MOTION_BUILD_ID ?? "unlabeled-dev-build", event: "swipe-row-frame", ...frame })}`,
	);
}

function shouldLogFrame({
	enabled,
	initialized,
	changed,
	wasActive,
	idleCount,
}: {
	enabled: boolean;
	initialized: boolean;
	changed: boolean;
	wasActive: boolean;
	idleCount: number;
}) {
	"worklet";
	return enabled && (!initialized || changed || (wasActive && idleCount < 3));
}

export function logMobileMotionFrame(
	id: string,
	timestampMs: number,
	deltaMs: number,
	value: number,
) {
	console.info(
		`TOLARIA_MOTION_FRAME ${JSON.stringify({ buildId: process.env.EXPO_PUBLIC_TOLARIA_MOTION_BUILD_ID ?? "unlabeled-dev-build", deltaMs, id, timestampMs, value })}`,
	);
}
