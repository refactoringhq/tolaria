import { describe, expect, it } from "vitest";
import { analyzeMobileMotionFrames } from "./mobileMotionFrameAnalysis";

describe("mobile frame motion analysis", () => {
	it("accepts steady coordinates and measures frame gaps", () => {
		expect(
			analyzeMobileMotionFrames([
				{ deltaMs: 16.7, timestampMs: 16.7, value: 120 },
				{ deltaMs: 16.7, timestampMs: 33.4, value: 120 },
				{ deltaMs: 16.7, timestampMs: 50.1, value: 120 },
			]),
		).toEqual({
			maxFrameGapMs: 16.7,
			maxReverseDelta: 0,
			monotonic: true,
			sampleCount: 3,
			timestampsMonotonic: true,
		});
	});

	it("rejects out-of-order frame timestamps", () => {
		expect(
			analyzeMobileMotionFrames([
				{ deltaMs: 16.7, timestampMs: 33.4, value: 120 },
				{ deltaMs: 16.7, timestampMs: 16.7, value: 120 },
			]),
		).toMatchObject({ timestampsMonotonic: false });
	});

	it("rejects a reverse jump in an otherwise leftward swipe", () => {
		expect(
			analyzeMobileMotionFrames([
				{ deltaMs: 16, timestampMs: 16, value: 40 },
				{ deltaMs: 16, timestampMs: 32, value: 20 },
				{ deltaMs: 16, timestampMs: 48, value: 28 },
			]),
		).toMatchObject({ maxReverseDelta: 8, monotonic: false, sampleCount: 3 });
	});
});
