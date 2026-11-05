import assert from "node:assert/strict";
import test from "node:test";

import { createVitestCommand } from "./vitest-coverage-command.mjs";

test("npm exec forwards coverage flags to Vitest", () => {
	assert.deepEqual(
		createVitestCommand(
			"/opt/homebrew/lib/node_modules/npm/bin/npm-cli.js",
			"/usr/bin/node",
			["vitest", "run", "--coverage", "--coverage.reporter=json"],
		),
		{
			command: "/usr/bin/node",
			args: [
				"/opt/homebrew/lib/node_modules/npm/bin/npm-cli.js",
				"exec",
				"--",
				"vitest",
				"run",
				"--coverage",
				"--coverage.reporter=json",
			],
		},
	);
});

test("pnpm JavaScript entrypoint keeps pnpm exec argument order", () => {
	assert.deepEqual(
		createVitestCommand("/opt/pnpm/pnpm.cjs", "/usr/bin/node", [
			"vitest",
			"--clearCache",
		]),
		{
			command: "/usr/bin/node",
			args: ["/opt/pnpm/pnpm.cjs", "exec", "vitest", "--clearCache"],
		},
	);
});

test("native package-manager entrypoints use pnpm from PATH", () => {
	assert.deepEqual(createVitestCommand(undefined, "/usr/bin/node", ["exec"]), {
		command: "pnpm",
		args: ["exec"],
	});
});
