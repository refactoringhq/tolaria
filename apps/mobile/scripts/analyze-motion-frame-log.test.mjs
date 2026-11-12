import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const analyzer = fileURLToPath(
	new URL("./analyze-motion-frame-log.mjs", import.meta.url),
);

test("new-note frame check requires the body-ready event before editor entry", (t) => {
	const directory = mkdtempSync(join(tmpdir(), "tolaria-motion-log-"));
	t.after(() => rmSync(directory, { recursive: true, force: true }));
	const path = join(directory, "simulator.log");
	const ready = event("new-note-editor-body-ready", 20);
	const editor = event("phone-state", 21, { state: "editor" });
	const list = event("first-list-frame", 1, { width: 402 });
	const slide = [frame(22, 0), frame(38, -350)];
	writeFileSync(
		path,
		[
			list,
			frame(9, 0),
			event("new-note-editor-prepare", 10, { canCreateNote: true }),
			ready,
			editor,
			...slide,
		].join("\n"),
	);
	assert.equal(runAnalyzer(path).status, 0);

	writeFileSync(
		path,
		[
			list,
			frame(9, 0),
			event("new-note-editor-prepare", 10),
			event("phone-state", 15, { state: "editor" }),
			ready,
			...slide,
		].join("\n"),
	);
	assert.equal(runAnalyzer(path).status, 1);

	writeFileSync(
		path,
		[
			list,
			frame(9, 0),
			event("new-note-editor-prepare", 10),
			ready,
			editor,
			frame(22, 0),
			frame(38, -20),
		].join("\n"),
	);
	assert.equal(runAnalyzer(path).status, 1);
});

test("note-open check fails when body renders lack visible content fingerprints", (t) => {
	const directory = mkdtempSync(join(tmpdir(), "tolaria-motion-log-"));
	t.after(() => rmSync(directory, { recursive: true, force: true }));
	const path = join(directory, "simulator.log");
	writeFileSync(path, noteOpenLog([{ noteId: "note-1", render: 1 }]));
	assert.equal(runAnalyzer(path, "--note-body-only").status, 1);
});

test("note-open check fails when body content changes more than once", (t) => {
	const directory = mkdtempSync(join(tmpdir(), "tolaria-motion-log-"));
	t.after(() => rmSync(directory, { recursive: true, force: true }));
	const path = join(directory, "simulator.log");
	writeNoteOpenLog(path, [contentRender("a"), contentRender("b", 2)]);
	assert.equal(runAnalyzer(path, "--note-body-only").status, 1);
});

test("note-open check fails on repeated body renders with unchanged content", (t) => {
	const path = createNoteOpenLog(t, [
		contentRender("a"),
		contentRender("a", 2),
	]);
	assert.equal(
		runAnalyzer(path, "--note-body-only", "fixture-build").status,
		1,
	);
});

test("note-open check passes exactly one content-bearing body render", (t) => {
	const path = createNoteOpenLog(t, [contentRender("a")]);
	assert.equal(
		runAnalyzer(path, "--note-body-only", "fixture-build").status,
		0,
	);
	assert.equal(runAnalyzer(path, "--note-body-only", "stale-build").status, 1);
});

test("note-entry check requires exactly one content-bearing render", (t) => {
	const path = createNoteOpenLog(t, [contentRender("entry")]);
	assert.equal(
		runAnalyzer(path, "--note-body-entry-only", "fixture-build").status,
		0,
	);
	writeNoteOpenLog(path, [contentRender("entry"), contentRender("entry", 2)]);
	assert.equal(
		runAnalyzer(path, "--note-body-entry-only", "fixture-build").status,
		1,
	);
});

test("full run fails when chrome is not laid out within the first frame", (t) => {
	const directory = mkdtempSync(join(tmpdir(), "tolaria-motion-log-"));
	t.after(() => rmSync(directory, { recursive: true, force: true }));
	const path = join(directory, "simulator.log");
	writeFileSync(
		path,
		[
			event("first-list-frame", 1, { width: 402 }),
			event("chrome-layout", 30, { control: "hamburger" }),
			event("fab-layout", 30, { x: 1 }),
			event("phone-state", 10, { state: "list" }),
			event("phone-state", 20, { state: "editor" }),
			event("phone-state", 40, { state: "list" }),
			event("note-body-render", 22, {
				noteId: "note-1",
				render: 1,
				contentFingerprint: "a",
				contentLength: 12,
			}),
			event("new-note-editor-prepare", 50),
			event("new-note-editor-body-ready", 51),
			event("phone-state", 52, { state: "editor" }),
			frame(53, 0),
			frame(69, -350),
			...Array.from(
				{ length: 2 },
				(_, index) =>
					`TOLARIA_MOTION_FRAME ${JSON.stringify({ id: "organize-swipe.workflow-orchestration", timestampMs: 100 + index * 16, value: index * 10 })}`,
			),
		].join("\n"),
	);
	assert.equal(runAnalyzer(path, "--full").status, 1);
});

test("full run recognizes organize swipe frame ids with a file extension", (t) => {
	const directory = mkdtempSync(join(tmpdir(), "tolaria-motion-log-"));
	t.after(() => rmSync(directory, { recursive: true, force: true }));
	const path = join(directory, "simulator.log");
	writeFileSync(
		path,
		[
			event("first-list-frame", 1, { width: 402 }),
			event("chrome-layout", 2, { control: "hamburger" }),
			event("fab-layout", 2, { x: 1 }),
			event("phone-state", 10, { state: "list" }),
			event("phone-state", 20, { state: "editor" }),
			event("note-body-render", 22, {
				noteId: "workflow-orchestration.md",
				contentFingerprint: "a",
				contentLength: 12,
			}),
			event("phone-state", 40, { state: "list" }),
			frame(41, 0),
			frame(57, -350),
			event("new-note-editor-prepare", 60),
			event("new-note-editor-body-ready", 61),
			event("phone-state", 62, { state: "editor" }),
			frame(63, 0),
			frame(79, -350),
			...Array.from(
				{ length: 2 },
				(_, index) =>
					`TOLARIA_MOTION_FRAME ${JSON.stringify({ id: "phone.rail.offset", timestampMs: 100 + index * 16, value: index * 10 })}`,
			),
			...Array.from(
				{ length: 2 },
				(_, index) =>
					`TOLARIA_MOTION_FRAME ${JSON.stringify({ id: "organize-swipe.workflow-orchestration.md", timestampMs: 200 + index * 16, value: index * 10 })}`,
			),
		].join("\n"),
	);
	assert.equal(runAnalyzer(path, "--full", "fixture-build").status, 0);
});

test("large-vault launch check requires first-frame controls and the expected build", (t) => {
	const directory = mkdtempSync(join(tmpdir(), "tolaria-motion-log-"));
	t.after(() => rmSync(directory, { recursive: true, force: true }));
	const path = join(directory, "simulator.log");
	writeFileSync(
		path,
		[
			event("first-list-frame", 10, { width: 402, height: 812 }),
			event("chrome-layout", 11, {
				control: "hamburger",
				width: 43,
				height: 43,
			}),
			event("fab-layout", 12, { width: 48, height: 48 }),
		].join("\n"),
	);
	assert.equal(runAnalyzer(path, "--launch-only", "fixture-build").status, 0);
	assert.equal(runAnalyzer(path, "--launch-only", "stale-build").status, 1);

	writeFileSync(
		path,
		event("first-list-frame", 10, { width: 402, height: 812 }),
	);
	assert.equal(runAnalyzer(path, "--launch-only", "fixture-build").status, 1);
});

test("launch check reads motion events from Expo JSON log envelopes", (t) => {
	const directory = mkdtempSync(join(tmpdir(), "tolaria-motion-log-"));
	t.after(() => rmSync(directory, { recursive: true, force: true }));
	const path = join(directory, "simulator.log");
	const envelope = (name, at, extra = {}) =>
		JSON.stringify({
			data: [
				`TOLARIA_MOTION_EVENT ${JSON.stringify({ buildId: "fixture-build", event: name, at, ...extra })}`,
			],
		});
	writeFileSync(
		path,
		[
			envelope("first-list-frame", 10, { width: 402, height: 812 }),
			envelope("chrome-layout", 11, {
				control: "hamburger",
				width: 43,
				height: 43,
			}),
			envelope("fab-layout", 12, { width: 48, height: 48 }),
		].join("\n"),
	);
	assert.equal(runAnalyzer(path, "--launch-only", "fixture-build").status, 0);
});

test("delayed cached startup keeps one list mounted with chrome before preparation", (t) => {
	const directory = mkdtempSync(join(tmpdir(), "tolaria-motion-log-"));
	t.after(() => rmSync(directory, { recursive: true, force: true }));
	const path = join(directory, "simulator.log");
	writeFileSync(path, delayedStartupLog(1));
	const result = runAnalyzer(path, "--startup-only", "fixture-build");
	assert.equal(result.status, 0, result.stderr);
	const report = JSON.parse(result.stdout);
	assert.equal(report.startup.listMountsBeforePreparation, 1);
	assert.equal(report.startup.listPresentationsBeforePreparation, 1);
	assert.equal(report.startup.totalListPresentations, 1);
	assert.equal(report.startup.preparationDelayMs, 79);
	assert.equal(report.startup.controlsWithinFirstFrame, true);

	writeFileSync(path, delayedStartupLog(2));
	assert.equal(runAnalyzer(path, "--startup-only", "fixture-build").status, 1);
});

test("startup create check verifies the first-frame action is accepted during delayed preparation", (t) => {
	const directory = mkdtempSync(join(tmpdir(), "tolaria-motion-log-"));
	t.after(() => rmSync(directory, { recursive: true, force: true }));
	const path = join(directory, "simulator.log");
	writeFileSync(
		path,
		[
			event("first-list-frame", 1, { width: 402, height: 812 }),
			event("chrome-layout", 2, {
				control: "hamburger",
				width: 44,
				height: 44,
			}),
			event("fab-layout", 2, { width: 48, height: 48 }),
			event("new-note-editor-prepare", 10, { canCreateNote: true }),
			event("phone-state", 20, { state: "editor" }),
		].join("\n"),
	);
	const result = runAnalyzer(
		path,
		"--startup-create-only",
		"fixture-build",
		10000,
	);
	assert.equal(result.status, 0, result.stderr);
	assert.equal(JSON.parse(result.stdout).startupCreate.createAccepted, true);
	assert.equal(
		JSON.parse(result.stdout).startupCreate.preparationPending,
		true,
	);

	writeFileSync(path, pathEventsWithoutEditorPreparation());
	assert.equal(
		runAnalyzer(path, "--startup-create-only", "fixture-build", 10000).status,
		1,
	);
});

test("startup create check fails when the first-frame tap never reaches the editor", (t) => {
	const directory = mkdtempSync(join(tmpdir(), "tolaria-motion-log-"));
	t.after(() => rmSync(directory, { recursive: true, force: true }));
	const path = join(directory, "simulator.log");
	writeFileSync(
		path,
		[
			event("first-list-frame", 1, { width: 402, height: 812 }),
			event("chrome-layout", 2, {
				control: "hamburger",
				width: 44,
				height: 44,
			}),
			event("fab-layout", 2, { width: 48, height: 48 }),
			event("new-note-editor-prepare", 3, { canCreateNote: true }),
			event("native-workspace-prepared", 100),
		].join("\n"),
	);
	const result = runAnalyzer(path, "--startup-create-only", "fixture-build");
	assert.equal(result.status, 1);
	assert.equal(JSON.parse(result.stdout).startupCreate.editorAt, null);
});

function pathEventsWithoutEditorPreparation() {
	return [
		event("first-list-frame", 1, { width: 402, height: 812 }),
		event("chrome-layout", 2, {
			control: "hamburger",
			width: 44,
			height: 44,
		}),
		event("fab-layout", 2, { width: 48, height: 48 }),
		event("native-workspace-prepared", 80),
		event("phone-state", 81, { state: "editor" }),
	].join("\n");
}

function noteOpenLog(renders) {
	return [
		event("phone-state", 1, { state: "list" }),
		event("phone-state", 2, { state: "editor" }),
		...renders.map((render, index) =>
			event("note-body-render", 3 + index, render),
		),
		event("phone-state", 8, { state: "list" }),
	].join("\n");
}

function delayedStartupLog(mountCount) {
	const mounts = Array.from({ length: mountCount }, (_, index) =>
		event("phone-note-list-mount", index + 2, { noteCount: 6000 }),
	);
	return [
		event("startup-preview-consumed", 1, {
			hasHamburger: true,
			hasCreateAction: true,
		}),
		...mounts,
		event("first-list-frame", 4, { width: 402, height: 812 }),
		event("chrome-layout", 5, {
			control: "hamburger",
			width: 44,
			height: 44,
		}),
		event("fab-layout", 5, { width: 48, height: 48 }),
		event("phone-note-list-render", 6, { noteCount: 6000, render: 1 }),
		event("native-workspace-prepared", 80),
	].join("\n");
}

function createNoteOpenLog(t, renders) {
	const directory = mkdtempSync(join(tmpdir(), "tolaria-motion-log-"));
	t.after(() => rmSync(directory, { recursive: true, force: true }));
	const path = join(directory, "simulator.log");
	writeNoteOpenLog(path, renders);
	return path;
}

function writeNoteOpenLog(path, renders) {
	writeFileSync(path, noteOpenLog(renders));
}

function contentRender(contentFingerprint, render = 1) {
	return { noteId: "note-1", render, contentFingerprint, contentLength: 12 };
}

function event(name, at, extra = {}) {
	return `TOLARIA_MOTION_EVENT ${JSON.stringify({ buildId: "fixture-build", event: name, at, ...extra })}`;
}

function frame(timestampMs, value) {
	return `TOLARIA_MOTION_FRAME ${JSON.stringify({ id: "phone.rail.offset", timestampMs, value })}`;
}

function runAnalyzer(
	path,
	check = "--new-note-only",
	expectedBuildId,
	expectedDelay,
) {
	return spawnSync(process.execPath, [analyzer, path, check], {
		encoding: "utf8",
		env: {
			...process.env,
			...(expectedBuildId
				? { EXPO_PUBLIC_TOLARIA_MOTION_BUILD_ID: expectedBuildId }
				: {}),
			...(expectedDelay
				? { TOLARIA_MOTION_EXPECT_PREPARATION_DELAY_MS: String(expectedDelay) }
				: {}),
		},
	});
}
