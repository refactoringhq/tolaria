#!/usr/bin/env node
import { readFileSync } from "node:fs";
import {
	analyzeFirstListFrame,
	analyzeStartup,
} from "./analyze-startup-motion.mjs";

const path = process.argv[2];
if (!path)
	throw new Error("Usage: analyze-motion-frame-log.mjs <simulator-log.txt>");
const source = readFileSync(path, "utf8");
const newNoteOnly = process.argv.includes("--new-note-only");
const frames = readFrames(source);
const events = readEvents(source);
const expectedBuildId = process.env.EXPO_PUBLIC_TOLARIA_MOTION_BUILD_ID ?? null;
const observedBuildIds = [
	...[...frames.values()].flat().map((sample) => sample.buildId),
	...events.map((event) => event.buildId),
].filter(Boolean);
const buildIdMatches = expectedBuildId
	? new Set(observedBuildIds).size === 1 &&
		observedBuildIds[0] === expectedBuildId
	: null;
const checks = Object.fromEntries(
	[...frames].map(([id, samples]) => [id, analyze(samples)]),
);
const firstListFrame = analyzeFirstListFrame(events);
const noteBody = analyzeNoteBody(events);
const noteBodyEntry = analyzeNoteBodyEntry(events);
const newNoteEntry = analyzeNewNoteEntry(
	events,
	frames.get("phone.rail.offset") ?? [],
	firstListFrame.listFrame?.width ?? 0,
);
const fabPosition = analyzeFabTransitions(
	events,
	frames.get("phone.rail.offset") ?? [],
	frames.get("phone.fab.viewport.x") ?? [],
);
const noteBodyOnly = process.argv.includes("--note-body-only");
const noteBodyEntryOnly = process.argv.includes("--note-body-entry-only");
const launchOnly = process.argv.includes("--launch-only");
const startupOnly = process.argv.includes("--startup-only");
const startupCreateOnly = process.argv.includes("--startup-create-only");
const startupCreate = analyzeStartupCreate(events, firstListFrame);
const report = {
	buildIds: [...new Set(observedBuildIds)],
	buildIdMatches,
	expectedBuildId,
	checks,
	eventCounts: countEvents(events),
	frameCount: [...frames.values()].reduce(
		(sum, samples) => sum + samples.length,
		0,
	),
	noteBody,
	noteBodyEntry,
	newNoteEntry,
	firstListFrame,
	startup: analyzeStartup(events, expectedBuildId, analyzeFirstListFrame),
	startupCreate,
	fabPosition,
	notTested: [],
};
process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);

if (
	launchOnly
		? !firstListFrame.controlsWithinFirstFrame || buildIdMatches !== true
		: startupOnly
			? !report.startup.passed || buildIdMatches !== true
			: startupCreateOnly
				? !startupCreate.passed || buildIdMatches !== true
				: noteBodyOnly
					? !noteBody.passed || buildIdMatches === false
					: noteBodyEntryOnly
						? !noteBodyEntry.passed || buildIdMatches === false
						: newNoteOnly
							? !newNoteEntry.passed || buildIdMatches === false
							: !checks["phone.rail.offset"]?.sampleCount ||
								checks["phone.rail.offset"].sampleCount <= 1 ||
								!Object.entries(checks).some(
									([id, check]) =>
										id.startsWith("organize-swipe.workflow-orchestration") &&
										check.sampleCount > 1,
								) ||
								!firstListFrame.controlsWithinFirstFrame ||
								!noteBody.passed ||
								buildIdMatches === false ||
								noteBody.renderEvents === 0 ||
								!newNoteEntry.passed
)
	process.exitCode = 1;

function analyzeStartupCreate(events, firstFrame) {
	const prepared = events.find(
		(event) => event.event === "native-workspace-prepared",
	);
	const create = events.find(
		(event) => event.event === "new-note-editor-prepare",
	);
	const editor = events.find(
		(event) => event.event === "phone-state" && event.state === "editor",
	);
	const frameAt = firstFrame.listFrame?.at;
	const createAfterFrame = Boolean(create && frameAt && create.at > frameAt);
	const editorBeforePreparation = occurredBefore(editor, prepared);
	const preparationPending = hasPendingPreparation(prepared);
	const report = {
		controlsWithinFirstFrame: firstFrame.controlsWithinFirstFrame,
		createAfterFirstFrame: createAfterFrame,
		editorBeforePreparation,
		createAccepted: Boolean(create?.canCreateNote),
		editorAt: editor?.at ?? null,
		preparedAt: prepared?.at ?? null,
		preparationPending,
	};
	return { ...report, passed: startupCreatePassed(report) };
}

function occurredBefore(event, otherEvent) {
	return Boolean(event && (!otherEvent || event.at < otherEvent.at));
}

function hasPendingPreparation(prepared) {
	return (
		Number(process.env.TOLARIA_MOTION_EXPECT_PREPARATION_DELAY_MS ?? 0) > 0 &&
		!prepared
	);
}

function startupCreatePassed(report) {
	return Boolean(
		report.controlsWithinFirstFrame &&
			report.createAfterFirstFrame &&
			report.createAccepted &&
			report.editorAt &&
			(!report.preparationPending || report.editorBeforePreparation),
	);
}

function readFrames(log) {
	const frames = new Map();
	for (const payload of payloads(log, "TOLARIA_MOTION_FRAME")) {
		const sample = JSON.parse(payload);
		const samples = frames.get(sample.id) ?? [];
		samples.push(sample);
		frames.set(sample.id, samples);
	}
	return frames;
}

function readEvents(log) {
	return payloads(log, "TOLARIA_MOTION_EVENT").map((payload) =>
		JSON.parse(payload),
	);
}

function payloads(log, marker) {
	const results = [];
	for (const line of log.split(/\r?\n/u)) {
		const message = loggedMessage(line, marker);
		if (message) results.push(message);
	}
	return results;
}

function loggedMessage(line, marker) {
	const message = envelopeMessage(line, marker) ?? line;
	const index = message.indexOf(marker);
	return index < 0 ? null : message.slice(index + marker.length).trim();
}

function envelopeMessage(line, marker) {
	try {
		const envelope = JSON.parse(line);
		return envelope.data?.find(
			(value) => typeof value === "string" && value.includes(marker),
		);
	} catch {
		return null;
	}
}

function analyze(samples) {
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

function countEvents(events) {
	return Object.fromEntries(
		events.reduce(
			(counts, event) =>
				counts.set(event.event, (counts.get(event.event) ?? 0) + 1),
			new Map(),
		),
	);
}

function analyzeNoteBody(events) {
	const noteRenders = events.filter(
		(event) => event.event === "note-body-render",
	);
	const openRenders = noteOpenRenders(events, noteRenders);
	const contentRenders = noteRenders.filter(
		(event) => event.contentFingerprint,
	);
	const openContentRenders = openRenders.filter(
		(event) => event.contentFingerprint,
	);
	const fingerprintChanges = countFingerprintChanges(contentRenders);
	const openFingerprintChanges = countFingerprintChanges(openContentRenders);
	const openNoteIds = [...new Set(openRenders.map((event) => event.noteId))];
	const openMissingFingerprints = openRenders.filter(
		(event) => !event.contentFingerprint,
	).length;
	const passed =
		openRenders.length > 0 &&
		openRenders.length === 1 &&
		openContentRenders.length === 1 &&
		openFingerprintChanges === 1 &&
		openMissingFingerprints === 0 &&
		openNoteIds.length === 1;
	return {
		contentRenders: contentRenders.length,
		exactlyOneRender: noteRenders.length === 1,
		fingerprintChanges,
		openFingerprintChanges,
		openContentRenders: openContentRenders.length,
		openExactlyOneRender: openRenders.length === 1,
		openMissingFingerprints,
		openNoteIds,
		openRenderEvents: openRenders.length,
		passed,
		renderEvents: noteRenders.length,
		oneBodyChange: passed,
	};
}

function analyzeNoteBodyEntry(events) {
	const renders = events.filter(
		(event) => event.event === "note-body-render" && event.contentFingerprint,
	);
	const noteIds = [...new Set(renders.map((event) => event.noteId))];
	return {
		passed: renders.length === 1 && noteIds.length === 1,
		renderCount: renders.length,
		noteIds,
		contentFingerprint: renders[0]?.contentFingerprint ?? null,
	};
}

function analyzeNewNoteEntry(events, railSamples, viewportWidth) {
	const preparations = events.filter(
		(event) => event.event === "new-note-editor-prepare",
	);
	const entries = preparations.map((preparation, index) =>
		analyzeNewNotePreparation({
			nextPreparationAt: preparations[index + 1]?.at,
			preparation,
			preparationAt: preparation.at,
			events,
			railSamples,
			viewportWidth,
		}),
	);
	const completeEntries = entries.filter(isCompleteNewNoteEntry);
	return {
		bodyReadyBeforeEditor: completeEntries.length > 0,
		completedEntries: completeEntries.length,
		entries,
		passed: completeEntries.length > 0,
		preparations: preparations.length,
		viewportWidth,
	};
}

function analyzeNewNotePreparation({
	nextPreparationAt,
	preparation,
	preparationAt,
	events,
	railSamples,
	viewportWidth,
}) {
	const endAt = nextPreparationAt ?? Infinity;
	const bodyReady = findNewNoteBodyReady(events, preparation.at, endAt);
	const editor = findNewNoteEditor(events, bodyReady, endAt);
	return {
		...newNoteTimeline(bodyReady, editor),
		...analyzeNewNoteRailMotion(
			editor,
			preparationAt,
			railSamples,
			viewportWidth,
		),
	};
}

function findNewNoteBodyReady(events, startAt, endAt) {
	return firstEventAfter(
		events,
		startAt,
		endAt,
		(event) => event.event === "new-note-editor-body-ready",
	);
}

function findNewNoteEditor(events, bodyReady, endAt) {
	if (!bodyReady) return undefined;
	return firstEventAfter(events, bodyReady.at, endAt, isEditorState);
}

function newNoteTimeline(bodyReady, editor) {
	return {
		bodyReadyAt: bodyReady?.at ?? null,
		bodyReadyBeforeEditor: Boolean(bodyReady && editor),
		bodyToEditorMs: elapsedBodyToEditor(bodyReady, editor),
		editorAt: editor?.at ?? null,
	};
}

function elapsedBodyToEditor(bodyReady, editor) {
	if (!bodyReady || !editor) return null;
	return round(editor.at - bodyReady.at);
}

function firstEventAfter(events, startAt, endAt, predicate) {
	return events.find(
		(event) => event.at > startAt && event.at < endAt && predicate(event),
	);
}

function analyzeNewNoteRailMotion(
	editor,
	preparationAt,
	railSamples,
	viewportWidth,
) {
	const startingSample = railSamples
		.filter((sample) => sample.timestampMs <= preparationAt)
		.at(-1);
	const motionSamples = railSamples.filter(
		(sample) =>
			sample.timestampMs >= (editor?.at ?? Infinity) &&
			sample.timestampMs <= (editor?.at ?? -Infinity) + 600,
	);
	const railPositions = [
		startingSample?.value,
		...motionSamples.map((sample) => sample.value),
	].filter(Number.isFinite);
	const railTravelPx =
		railPositions.length > 1
			? Math.abs(railPositions.at(-1) - railPositions[0])
			: 0;
	return {
		railFrameCount: motionSamples.length,
		railSlidesIn: railTravelPx >= viewportWidth * 0.8,
		railTravelPx: round(railTravelPx),
	};
}

function isCompleteNewNoteEntry(entry) {
	return entry.bodyReadyBeforeEditor && entry.railSlidesIn;
}

function noteOpenRenders(events, noteRenders) {
	const openState = events.find(isEditorState);
	if (!openState) return [];
	const listStates = events.filter(isListState);
	const priorList = latestBefore(listStates, openState.at);
	const closeList = listStates.find((event) => event.at > openState.at);
	if (!priorList || !closeList) return [];
	return noteRenders.filter(
		(event) => event.at >= priorList.at && event.at <= closeList.at,
	);
}

function isEditorState(event) {
	return event.event === "phone-state" && event.state === "editor";
}

function isListState(event) {
	return event.event === "phone-state" && event.state === "list";
}

function countFingerprintChanges(events) {
	let changes = 0;
	let previous;
	for (const event of events) {
		if (
			event.noteId !== previous?.noteId ||
			event.contentFingerprint !== previous?.contentFingerprint
		)
			changes += 1;
		previous = event;
	}
	return changes;
}

function latestBefore(events, timestamp) {
	return events
		.filter((event) => event.at < (timestamp ?? Number.NEGATIVE_INFINITY))
		.at(-1);
}

function analyzeFabTransitions(events, samples, viewportSamples) {
	const fab = events.find((event) => event.event === "fab-layout");
	const states = events.filter((event) => event.event === "phone-state");
	return states
		.slice(1)
		.map((current, index) => ({ previous: states[index], current }))
		.filter(isReturnToList)
		.map(({ previous, current }) =>
			measureFabTransition({
				current,
				fabX: fab?.x ?? 0,
				previous,
				samples,
				viewportSamples,
			}),
		);
}

function isReturnToList({ previous, current }) {
	if (current.state !== "list") return false;
	if (previous.state === "editor") return true;
	return previous.state === "sidebar";
}

function measureFabTransition({
	previous,
	current,
	samples,
	fabX,
	viewportSamples,
}) {
	const measuredPositions = viewportSamples
		.filter((sample) => sample.timestampMs >= previous.at)
		.filter((sample) => sample.timestampMs <= current.at + 250);
	const samplesToUse =
		measuredPositions.length > 1
			? measuredPositions
			: samples
					.filter((sample) => sample.timestampMs >= previous.at)
					.filter((sample) => sample.timestampMs <= current.at + 250);
	const positions = samplesToUse.map((sample) =>
		measuredPositions.length > 1 ? sample.value : sample.value + fabX,
	);
	const delta = positions.length
		? Math.max(...positions) - Math.min(...positions)
		: null;
	return {
		from: previous.state,
		maxPositionDelta: delta === null ? null : round(delta),
		name: `${previous.state}-to-list`,
		passed: positions.length > 1 && delta !== null && delta <= 1.5,
		positionSource:
			measuredPositions.length > 1 ? "fab-viewport-frame" : "rail-plus-layout",
		sampleCount: positions.length,
		to: current.state,
	};
}

function round(value) {
	return Math.round(value * 100) / 100;
}
