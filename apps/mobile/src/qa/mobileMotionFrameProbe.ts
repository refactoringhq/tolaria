import {
	runOnJS,
	type SharedValue,
	useFrameCallback,
	useSharedValue,
} from "react-native-reanimated";
import { mobileMotionFrameProbeEnabled } from "./mobileMotionFrameLog";

export { mobileMotionFrameProbeEnabled } from "./mobileMotionFrameLog";

export function useMobileMotionFrameProbe(
	id: string,
	value: SharedValue<number>,
	enabled = mobileMotionFrameProbeEnabled,
) {
	const previous = useSharedValue(Number.NaN);
	const active = useSharedValue(false);
	const idleFrames = useSharedValue(0);
	useFrameCallback((frame) => {
		"worklet";
		const current = value.get();
		const last = previous.get();
		const initialized = Number.isFinite(last);
		const changed = didFrameValueChange(current, last);
		const wasActive = active.get();
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

function didFrameValueChange(current: number, previous: number) {
	"worklet";
	return Number.isFinite(previous) && Math.abs(current - previous) > 0.01;
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
