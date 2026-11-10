export type MotionFrameSample = {
	deltaMs: number;
	timestampMs: number;
	value: number;
};

export type MotionFrameCheck = {
	maxFrameGapMs: number;
	maxReverseDelta: number;
	monotonic: boolean;
	sampleCount: number;
	timestampsMonotonic: boolean;
};

export function analyzeMobileMotionFrames(
	samples: MotionFrameSample[],
	tolerance = 1.5,
): MotionFrameCheck {
	let maxFrameGapMs = 0;
	let maxReverseDelta = 0;
	let timestampsMonotonic = true;
	let direction: -1 | 1 | null = null;

	for (let index = 1; index < samples.length; index += 1) {
		const measurement = measurePair(
			samples[index - 1],
			samples[index],
			direction,
		);
		if (!measurement) continue;
		maxFrameGapMs = Math.max(maxFrameGapMs, measurement.frameGapMs);
		maxReverseDelta = Math.max(maxReverseDelta, measurement.reverseDelta);
		timestampsMonotonic &&= measurement.timestampGapMs > 0;
		direction = measurement.direction;
	}

	return {
		maxFrameGapMs: round(maxFrameGapMs),
		maxReverseDelta: round(maxReverseDelta),
		monotonic: maxReverseDelta <= tolerance,
		sampleCount: samples.length,
		timestampsMonotonic,
	};
}

function measurePair(
	previous: MotionFrameSample | undefined,
	current: MotionFrameSample | undefined,
	direction: -1 | 1 | null,
) {
	if (!previous || !current) return null;
	const nextDirection =
		direction ??
		(current.value === previous.value
			? null
			: current.value > previous.value
				? 1
				: -1);
	return {
		direction: nextDirection,
		frameGapMs: current.deltaMs,
		reverseDelta:
			nextDirection === null
				? 0
				: (previous.value - current.value) * nextDirection,
		timestampGapMs: current.timestampMs - previous.timestampMs,
	};
}

function round(value: number) {
	return Math.round(value * 100) / 100;
}
