import { readdirSync, readFileSync } from "node:fs";

export function analyzeOrganizeSwipe(
	frames,
	events,
	geometryDirectory,
	nativeRowDismissalPassed,
) {
	const opened = findOrganizeAction(events);
	const id = opened?.noteId ?? longestOrganizeMotionId(frames);
	const measurements = measureSwipe(frames, events, id);
	const rowMotion = measureRowMotion(events, id, geometryDirectory);
	const motion = withContinuousSummary(
		analyzePositionMotion(measurements.position),
		latestMotionSummary(events, id),
	);
	const secondaryActionHeldHidden = staysHiddenAfterReveal(
		measurements.secondary,
	);
	return createOrganizeReport({
		opened,
		measurements,
		motion,
		rowMotion,
		secondaryActionHeldHidden,
		nativeRowDismissalPassed,
	});
}

function measureSwipe(frames, events, id) {
	const position = frames.get(`organize-swipe.${id}`) ?? [];
	const gesture = frames.get(`organize-swipe-gesture.${id}`) ?? [];
	const secondary = frames.get(`organize-swipe.secondary-width.${id}`) ?? [];
	return {
		position,
		gesture,
		secondary,
		crossedFullThreshold: crossedSwipeThreshold(
			gesture,
			position,
			rowWidth(findOrganizeAction(events), events),
		),
	};
}

function measureRowMotion(events, id, geometryDirectory) {
	const attached = readGeometryAttachments(geometryDirectory);
	const frameGeometryPresent = events.some(
		(event) => event.event === "swipe-row-frame" && event.noteId === id,
	);
	return analyzeRowGeometry([
		...layoutEventsForNote(events, id),
		...(frameGeometryPresent ? [] : attached),
	]);
}

function createOrganizeReport({
	opened,
	measurements,
	motion,
	rowMotion,
	secondaryActionHeldHidden,
	nativeRowDismissalPassed,
}) {
	const { position, gesture, secondary, crossedFullThreshold } = measurements;
	return {
		buildId: opened?.buildId ?? position[0]?.buildId ?? null,
		measurementSource:
			position.length > 1 ? "reanimated-frame-probe" : "missing",
		crossedFullThreshold,
		...rowMotion,
		position,
		positionMotion: motion,
		secondaryActionHeldHidden,
		secondaryWidthSamples: secondary.length,
		rowDismissalVerifiedByXCUITest: nativeRowDismissalPassed,
		intermediateRowCollapseMeasured:
			rowMotion.heightCollapsed && rowMotion.gapClosed,
		passed: allChecksPassed({
			opened,
			position,
			crossedFullThreshold,
			motion,
			rowMotion,
			secondaryActionHeldHidden,
			nativeRowDismissalPassed,
		}),
		gestureSamples: gesture.length,
	};
}

function allChecksPassed({
	opened,
	position,
	crossedFullThreshold,
	motion,
	rowMotion,
	secondaryActionHeldHidden,
	nativeRowDismissalPassed,
}) {
	return [
		Boolean(opened),
		crossedFullThreshold,
		position.length > 1,
		motion.monotonic,
		rowMotion.heightCollapsed,
		rowMotion.heightMonotonic,
		rowMotion.gapClosed,
		rowMotion.gapMotionMonotonic,
		rowMotion.visualPositionMonotonic,
		secondaryActionHeldHidden,
		nativeRowDismissalPassed,
	].every(Boolean);
}

function readGeometryAttachments(directory) {
	if (!directory) return [];
	let entries;
	try {
		entries = readdirSync(directory, { withFileTypes: true });
	} catch {
		return [];
	}
	return entries
		.filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
		.flatMap((entry) => {
			try {
				const content = JSON.parse(
					readFileSync(`${directory}/${entry.name}`, "utf8"),
				);
				return Array.isArray(content) ? content : [];
			} catch {
				return [];
			}
		});
}

function findOrganizeAction(events) {
	return events.find(
		(event) =>
			["swipe-action-commit", "swipe-action-open"].includes(event.event) &&
			event.action === "organize",
	);
}

function rowWidth(opened, events) {
	return (
		opened?.rowWidth ??
		events.find((event) => event.event === "first-list-frame")?.width ??
		0
	);
}

function crossedSwipeThreshold(gesture, position, width) {
	if (gesture.length > 0)
		return gesture.some((sample) => sample.value <= -width * 0.68);
	return position.some((sample) => sample.value <= -width * 0.68);
}

function latestMotionSummary(events, id) {
	return events
		.filter(
			(event) =>
				event.event === "motion-frame-summary" &&
				event.id === `organize-swipe.${id}` &&
				event.sampleCount > 0,
		)
		.at(-1);
}

function withContinuousSummary(positionMotion, summary) {
	if (!summary)
		return { ...positionMotion, continuousWorkletMeasurement: false };
	return {
		...positionMotion,
		maxReverseDelta: round(summary.maxReverseDelta),
		monotonic: summary.maxReverseDelta <= 1.5,
		sampleCount: summary.sampleCount,
		continuousWorkletMeasurement: true,
	};
}

function longestOrganizeMotionId(frames) {
	const match = [...frames.entries()]
		.filter(([id]) => id.startsWith("organize-swipe."))
		.sort((left, right) => right[1].length - left[1].length)[0]?.[0];
	return match?.slice("organize-swipe.".length) ?? "";
}

function layoutEventsForNote(events, noteId) {
	const frameSamples = events.filter(
		(event) => event.event === "swipe-row-frame",
	);
	const measuredEvents = frameSamples.some((event) => event.noteId === noteId)
		? frameSamples
		: events.filter((event) => event.event === "swipe-row-layout");
	const layouts = measuredEvents.map((event) => ({
		element: event.noteId === noteId ? "row" : "following",
		noteId: event.noteId,
		x: event.x,
		y: event.y,
		height: event.height,
		atUptime: event.at,
	}));
	const initialRow = layouts.find((sample) => sample.noteId === noteId);
	if (!initialRow) return [];
	const firstLayouts = firstLayoutByNote(layouts);
	const followingId = firstLayouts
		.filter((sample) => sample.y > initialRow.y)
		.sort((left, right) => left.y - right.y)[0]?.noteId;
	return layouts.filter(
		(sample) => sample.noteId === noteId || sample.noteId === followingId,
	);
}

function firstLayoutByNote(layouts) {
	const first = new Map();
	for (const sample of [...layouts].sort(
		(left, right) => left.atUptime - right.atUptime,
	)) {
		if (!first.has(sample.noteId)) first.set(sample.noteId, sample);
	}
	return [...first.values()];
}

function staysHiddenAfterReveal(samples) {
	const revealIndex = samples.findIndex((sample) => sample.value === 0);
	return (
		revealIndex >= 0 &&
		samples.slice(revealIndex).every((sample) => sample.value === 0)
	);
}

function analyzeRowGeometry(geometry) {
	const ordered = [...geometry].sort(
		(left, right) => left.atUptime - right.atUptime,
	);
	const rows = ordered.filter((sample) => sample.element === "row");
	const following = ordered.filter((sample) => sample.element === "following");
	const rowXs = rows
		.filter((sample) => sample.height > 0)
		.map((sample) => sample.x);
	const heights = rows.map((sample) => sample.height);
	const maxVisualReverseDelta = maximumReverseDelta(rowXs);
	const maxGapReverseDelta = maximumReverseDelta(
		following.map((sample) => sample.y),
	);
	return {
		gapClosed: following.length >= 2 && following.at(-1).y < following[0].y,
		heightCollapsed:
			heights.length >= 2 && heights[0] > 0 && heights.at(-1) === 0,
		heightMonotonic: heights.every(
			(height, index) => index === 0 || height <= heights[index - 1] + 1.5,
		),
		maxVisualReverseDelta,
		maxGapReverseDelta,
		rowHeightSamples: heights.length,
		gapMotionMonotonic: maxGapReverseDelta <= 1.5,
		visualPositionMonotonic: maxVisualReverseDelta <= 1.5,
	};
}

function maximumReverseDelta(values) {
	return values.reduce(
		(maximum, value, index) =>
			index === 0 ? maximum : Math.max(maximum, value - values[index - 1]),
		0,
	);
}

function analyzePositionMotion(samples) {
	let maxFrameGapMs = 0;
	let maxReverseDelta = 0;
	let direction = null;
	let timestampsMonotonic = true;
	for (let index = 1; index < samples.length; index += 1) {
		const previous = samples[index - 1];
		const current = samples[index];
		const timestampGap = current.timestampMs - previous.timestampMs;
		if (timestampGap <= 0) timestampsMonotonic = false;
		maxFrameGapMs = Math.max(maxFrameGapMs, current.deltaMs);
		if (direction === null && current.value !== previous.value)
			direction = current.value > previous.value ? 1 : -1;
		if (direction !== null)
			maxReverseDelta = Math.max(
				maxReverseDelta,
				(previous.value - current.value) * direction,
			);
	}
	return {
		maxFrameGapMs: round(maxFrameGapMs),
		maxFrameGapTargetMs: 1000 / 60,
		frameBudgetMet: maxFrameGapMs <= 1000 / 60 + 0.1,
		maxReverseDelta: round(maxReverseDelta),
		monotonic: maxReverseDelta <= 1.5,
		sampleCount: samples.length,
		timestampsMonotonic,
	};
}

function round(value) {
	return Math.round(value * 100) / 100;
}
