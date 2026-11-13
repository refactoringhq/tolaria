import assert from "node:assert/strict";
import { resolve } from "node:path";
import test from "node:test";
import { partitionApprovedReports } from "./codacy-approved-reports.mjs";

const root = resolve(import.meta.dirname, "..");
const now = Date.parse("2026-10-20T16:00:00Z");
const path = `${root}/apps/mobile/src/workspace/git/expoGitFileSystem.test.ts`;
const finding = {
	path,
	line: 21,
	rule: "codacy.tools-configs.javascript_pathtraversal_rule-non-literal-fs-filename",
	tool: "opengrep",
	message: "The application dynamically constructs file or path information.",
};

test("retains the exact owner-approved report separately from blocking reports", () => {
	assert.deepEqual(partitionApprovedReports([finding], root, { now }), {
		approved: [finding],
		blocking: [],
	});
});

test("an expired approval no longer applies, including at the exact expiry boundary", () => {
	const expires = Date.parse("2026-10-21T21:59:00Z");
	for (const timestamp of [expires, expires + 1]) {
		assert.deepEqual(
			partitionApprovedReports([finding], root, { now: timestamp }).blocking,
			[finding],
		);
	}
});

test("a changed source file cannot inherit an approval", () => {
	const read = () => Buffer.from("changed source");
	assert.deepEqual(
		partitionApprovedReports([finding], root, { now, read }).blocking,
		[finding],
	);
});

test("other files, lines, rules, scanner failures and missing sources still fail closed", () => {
	const other = [
		{ ...finding, path: `${root}/other.ts` },
		{ ...finding, line: 24 },
		{ ...finding, rule: "different-rule" },
		{ message: "Scanner failed", tool: "opengrep" },
	];
	assert.deepEqual(
		partitionApprovedReports(other, root, { now }).blocking,
		other,
	);
	assert.deepEqual(
		partitionApprovedReports([finding], root, {
			now,
			read: () => {
				throw new Error("missing");
			},
		}).blocking,
		[finding],
	);
});

test("approvals cannot be used by Stable release jobs", () => {
	assert.deepEqual(
		partitionApprovedReports([finding], root, { now, channel: "stable" })
			.blocking,
		[finding],
	);
});

const wryPath = `${root}/vendor/wry/src/wkwebview/synthetic_mouse_events.rs`;
const wryFinding = {
	path: wryPath,
	line: 10,
	rule: "codacy.tools-configs.rust.lang.security.unsafe-usage.unsafe-usage",
	tool: "opengrep",
	message: "Inherited vendored Wry unsafe-usage finding.",
};
const wryApprovalStartsAt = Date.parse("2026-11-13T16:37:00Z");

test("blocks the Wry unsafe finding after its stale approval is removed", () => {
	assert.deepEqual(
		partitionApprovedReports([wryFinding], root, { now: wryApprovalStartsAt }),
		{
			approved: [],
			blocking: [wryFinding],
		},
	);
});

test("keeps unmatched Wry findings, changed file bytes, and Stable scans fail-closed", () => {
	const unmatched = [
		{ ...wryFinding, line: 11 },
		{ ...wryFinding, rule: "different-rule" },
		{ ...wryFinding, path: `${root}/vendor/wry/src/lib.rs` },
	];
	assert.deepEqual(
		partitionApprovedReports(unmatched, root, { now: wryApprovalStartsAt })
			.blocking,
		unmatched,
	);
	assert.deepEqual(
		partitionApprovedReports([wryFinding], root, {
			now: wryApprovalStartsAt,
			read: () => Buffer.from("changed vendored source"),
		}).blocking,
		[wryFinding],
	);
	assert.deepEqual(
		partitionApprovedReports([wryFinding], root, {
			now: wryApprovalStartsAt,
			channel: "stable",
		}).blocking,
		[wryFinding],
	);
});
