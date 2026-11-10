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

function event(name, at, extra = {}) {
	return `TOLARIA_MOTION_EVENT ${JSON.stringify({ event: name, at, ...extra })}`;
}

function frame(timestampMs, value) {
	return `TOLARIA_MOTION_FRAME ${JSON.stringify({ id: "phone.rail.offset", timestampMs, value })}`;
}

function runAnalyzer(path) {
	return spawnSync(process.execPath, [analyzer, path, "--new-note-only"], {
		encoding: "utf8",
	});
}
