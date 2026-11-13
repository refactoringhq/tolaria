import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const analyzer = fileURLToPath(
	new URL("./analyze-motion-frame-log.mjs", import.meta.url),
);

test("organize swipe requires full reveal, stable motion, held action, and dismissal", (t) => {
	const fixture = createFixture(t);
	writeFileSync(fixture.log, acceptedSwipeLog());
	writeGeometry(fixture.attachments, [96, 72, 36, 0], [140, 116, 80, 44]);
	assert.equal(run(fixture.log, fixture.attachments, false).status, 1);
	const result = run(fixture.log, fixture.attachments, true);
	assert.equal(result.status, 0, result.stderr + result.stdout);
	const report = JSON.parse(result.stdout).organizeSwipe;
	assert.equal(report.crossedFullThreshold, true);
	assert.equal(report.positionMotion.maxReverseDelta, 0);
	assert.equal(report.secondaryActionHeldHidden, true);
	assert.equal(report.fullWidthCheckReveal, true);
	assert.ok(report.actionWidthSamples > 0);
	assert.equal(report.rowDismissalVerifiedByXCUITest, true);
});

test("organize swipe fails closed without a full-width check-only reveal", (t) => {
	const fixture = createFixture(t);
	writeFileSync(
		fixture.log,
		acceptedSwipeLog().replace(
			"organize-swipe-full-reveal",
			"organize-swipe-partial-reveal",
		),
	);
	writeGeometry(fixture.attachments, [96, 72, 36, 0], [140, 116, 80, 44]);
	const report = JSON.parse(
		run(fixture.log, fixture.attachments, true).stdout,
	).organizeSwipe;
	assert.equal(report.fullWidthCheckReveal, false);
	assert.equal(report.passed, false);
});

test("current-main style traces fail on measured rebound without a swipe-open event", (t) => {
	const fixture = createFixture(t);
	const offsets = [0, -80, -170, -270, -326, -314, -301, -290];
	writeFileSync(
		fixture.log,
		[
			event("first-list-frame", 1, { width: 402 }),
			...offsets.map((value, index) =>
				frame("organize-swipe.note-1.md", 100 + index * 16, value),
			),
		].join("\n"),
	);
	const result = run(fixture.log, fixture.attachments, false);
	const report = JSON.parse(result.stdout).organizeSwipe;
	assert.equal(result.status, 1);
	assert.equal(report.crossedFullThreshold, true);
	assert.equal(report.positionMotion.maxReverseDelta, 13);
	assert.equal(report.positionMotion.monotonic, false);
});

test("continuous frame summary rejects rebound after delayed log delivery", (t) => {
	const fixture = createFixture(t);
	writeFileSync(fixture.log, summaryLog(0));
	writeGeometry(fixture.attachments, [96, 72, 36, 0], [140, 116, 80, 44]);
	assert.equal(run(fixture.log, fixture.attachments, true).status, 0);
	writeFileSync(fixture.log, summaryLog(13));
	assert.equal(run(fixture.log, fixture.attachments, true).status, 1);
});

test("organize swipe layout measurements prove monotonic collapse and gap closure", (t) => {
	const fixture = createFixture(t);
	writeFileSync(fixture.log, acceptedSwipeLog());
	writeGeometry(fixture.attachments, [96, 72, 36, 0], [140, 116, 80, 44]);
	const report = JSON.parse(
		run(fixture.log, fixture.attachments, true).stdout,
	).organizeSwipe;
	assert.equal(report.rowHeightSamples, 4);
	assert.equal(report.heightMonotonic, true);
	assert.equal(report.heightCollapsed, true);
	assert.equal(report.gapClosed, true);
});

test("organize swipe fails closed when row collapse and list-gap frames are missing", (t) => {
	const fixture = createFixture(t);
	writeFileSync(fixture.log, acceptedSwipeLog());
	const result = run(fixture.log, fixture.attachments, true);
	assert.equal(result.status, 1);
	const report = JSON.parse(result.stdout).organizeSwipe;
	assert.equal(report.rowHeightSamples, 0);
	assert.equal(report.intermediateRowCollapseMeasured, false);
});

test("organize swipe rejects a rebound in row geometry even when translation summary is monotonic", (t) => {
	const fixture = createFixture(t);
	writeFileSync(fixture.log, acceptedSwipeLog());
	writeGeometry(
		fixture.attachments,
		[96, 62, 35, 0],
		[140, 106, 79, 44],
		[0, -100, -70, -300],
	);
	const report = JSON.parse(
		run(fixture.log, fixture.attachments, true).stdout,
	).organizeSwipe;
	assert.equal(report.visualPositionMonotonic, false);
	assert.equal(report.passed, false);
});

test("organize swipe rejects a list-gap rebound between measured frames", (t) => {
	const fixture = createFixture(t);
	writeFileSync(fixture.log, acceptedSwipeLog());
	writeGeometry(fixture.attachments, [96, 72, 36, 0], [140, 116, 132, 44]);
	const report = JSON.parse(
		run(fixture.log, fixture.attachments, true).stdout,
	).organizeSwipe;
	assert.equal(report.gapClosed, true);
	assert.equal(report.gapMotionMonotonic, false);
	assert.equal(report.passed, false);
});

function createFixture(t) {
	const directory = mkdtempSync(join(tmpdir(), "tolaria-organize-swipe-"));
	t.after(() => rmSync(directory, { recursive: true, force: true }));
	const attachments = join(directory, "attachments");
	mkdirSync(attachments);
	return { attachments, log: join(directory, "simulator.log") };
}

function acceptedSwipeLog() {
	return [
		...[-360, -380, -400].map((value, index) =>
			frame("organize-swipe-gesture.note-1.md", 100 + index * 16, value),
		),
		...[-216, -216, -216].map((value, index) =>
			frame("organize-swipe.note-1.md", 150 + index * 16, value),
		),
		...[72, 0, 0].map((value, index) =>
			frame(
				"organize-swipe.secondary-width.note-1.md",
				200 + index * 16,
				value,
			),
		),
		frame("organize-swipe.action-width.note-1.md", 245, 400),
		event("organize-swipe-full-reveal", 246, {
			action: "organize",
			actionWidth: 400,
			checkOnly: true,
			noteId: "note-1.md",
			rowWidth: 400,
			secondaryActionsVisible: false,
		}),
		event("swipe-action-commit", 250, {
			action: "organize",
			noteId: "note-1.md",
			rowWidth: 400,
		}),
		event("motion-frame-summary", 260, {
			id: "organize-swipe.note-1.md",
			maxReverseDelta: 0,
			sampleCount: 28,
		}),
	].join("\n");
}

function summaryLog(reverseDelta) {
	return [
		acceptedSwipeLog(),
		event("motion-frame-summary", 270, {
			id: "organize-swipe.note-1.md",
			maxReverseDelta: reverseDelta,
			sampleCount: 28,
		}),
	].join("\n");
}

function writeGeometry(
	directory,
	heights,
	followingY,
	rowXs = [-0, -100, -200, -300],
) {
	const samples = heights.flatMap((height, index) => [
		{ element: "row", atUptime: index, height, x: rowXs[index] },
		{ element: "following", atUptime: index, y: followingY[index] },
	]);
	writeFileSync(join(directory, "row-geometry.json"), JSON.stringify(samples));
}

function event(name, at, extra = {}) {
	return `TOLARIA_MOTION_EVENT ${JSON.stringify({ buildId: "fixture-build", event: name, at, ...extra })}`;
}

function frame(id, timestampMs, value) {
	return `TOLARIA_MOTION_FRAME ${JSON.stringify({ buildId: "fixture-build", id, timestampMs, deltaMs: 16, value })}`;
}

function run(logPath, attachmentsPath, dismissalPassed) {
	return spawnSync(
		process.execPath,
		[
			analyzer,
			logPath,
			"--organize-swipe-only",
			...(dismissalPassed ? ["--native-row-dismissal-passed"] : []),
			attachmentsPath,
		],
		{
			encoding: "utf8",
			env: {
				...process.env,
				EXPO_PUBLIC_TOLARIA_MOTION_BUILD_ID: "fixture-build",
			},
		},
	);
}
