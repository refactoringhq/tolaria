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

function runAnalyzer(path, check = "--new-note-only", expectedBuildId) {
	return spawnSync(process.execPath, [analyzer, path, check], {
		encoding: "utf8",
		env: {
			...process.env,
			...(expectedBuildId
				? { EXPO_PUBLIC_TOLARIA_MOTION_BUILD_ID: expectedBuildId }
				: {}),
		},
	});
}
