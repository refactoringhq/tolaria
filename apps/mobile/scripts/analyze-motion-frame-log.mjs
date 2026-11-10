#!/usr/bin/env node
import { readFileSync } from "node:fs";

const path = process.argv[2];
if (!path)
	throw new Error("Usage: analyze-motion-frame-log.mjs <simulator-log.txt>");
const source = readFileSync(path, "utf8");
const frames = readFrames(source);
const events = readEvents(source);
const checks = Object.fromEntries(
	[...frames].map(([id, samples]) => [id, analyze(samples)]),
);
const firstListFrame = analyzeFirstListFrame(events);
const noteBody = analyzeNoteBody(events);
const fabPosition = analyzeFabTransitions(
	events,
	frames.get("phone.rail.offset") ?? [],
);
const report = {
	buildIds: [
		...new Set(
			[...frames.values()]
				.flat()
				.map((sample) => sample.buildId)
				.concat(events.map((event) => event.buildId))
				.filter(Boolean),
		),
	],
	checks,
	eventCounts: countEvents(events),
	frameCount: [...frames.values()].reduce(
		(sum, samples) => sum + samples.length,
		0,
	),
	noteBody,
	firstListFrame,
	fabPosition,
	notTested: [
		"Artificially delayed vault loading; the app has no deterministic debug delay seam.",
	],
};
process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
if (
	!["phone.rail.offset", "organize-swipe.workflow-orchestration"].every(
		(id) => checks[id]?.sampleCount > 1,
	) ||
	!firstListFrame.controlsLaidOut ||
	noteBody.renderEvents === 0
)
	process.exitCode = 1;

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
		const index = line.indexOf(marker);
		if (index >= 0) results.push(line.slice(index + marker.length).trim());
	}
	return results;
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

function analyzeFirstListFrame(events) {
	const list = events.find((event) => event.event === "first-list-frame");
	const controls = events.filter((event) => event.event === "chrome-layout");
	const hamburger = controls.find((event) => event.control === "hamburger");
	const fab = events.find((event) => event.event === "fab-layout");
	const controlLayoutDelayMs =
		list && hamburger && fab
			? round(Math.max(hamburger.at, fab.at) - list.at)
			: null;
	return {
		controlsLaidOut: controlLayoutDelayMs !== null,
		controlsWithinFirstFrame:
			controlLayoutDelayMs !== null && controlLayoutDelayMs <= 1000 / 60,
		controlLayoutDelayMs,
		listFrame: list ?? null,
		controls: controls.map(({ control, height, width, x, y }) => ({
			control,
			height,
			width,
			x,
			y,
		})),
	};
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
	return {
		contentRenders: contentRenders.length,
		exactlyOneRender: noteRenders.length === 1,
		fingerprintChanges,
		openContentRenders: openContentRenders.length,
		openExactlyOneRender: openRenders.length === 1,
		openRenderEvents: openRenders.length,
		renderEvents: noteRenders.length,
		oneBodyChange: fingerprintChanges === 1,
	};
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

function analyzeFabTransitions(events, samples) {
	const fab = events.find((event) => event.event === "fab-layout");
	const states = events.filter((event) => event.event === "phone-state");
	return states
		.slice(1)
		.map((current, index) => ({ previous: states[index], current }))
		.filter(isReturnToList)
		.map(({ previous, current }) =>
			measureFabTransition(previous, current, samples, fab?.x ?? 0),
		);
}

function isReturnToList({ previous, current }) {
	if (current.state !== "list") return false;
	if (previous.state === "editor") return true;
	return previous.state === "sidebar";
}

function measureFabTransition(previous, current, samples, fabX) {
	const positions = samples
		.filter((sample) => sample.timestampMs >= previous.at)
		.filter((sample) => sample.timestampMs <= current.at + 250)
		.map((sample) => sample.value + fabX);
	const delta = positions.length
		? Math.max(...positions) - Math.min(...positions)
		: null;
	return {
		from: previous.state,
		maxPositionDelta: delta === null ? null : round(delta),
		name: `${previous.state}-to-list`,
		passed: positions.length > 1 && delta !== null && delta <= 1.5,
		sampleCount: positions.length,
		to: current.state,
	};
}

function round(value) {
	return Math.round(value * 100) / 100;
}
