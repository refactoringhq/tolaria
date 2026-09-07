import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";
import { requireVaultPaths } from "./vault-path.js";

test("packaged CommonJS vault path module starts without an import URL", async () => {
	const rootDir = await mkdtemp(
		path.join(os.tmpdir(), "tolaria-mcp-packaged-vault-path-"),
	);
	const outfile = path.join(rootDir, "vault-path.cjs");

	try {
		await build({
			bundle: true,
			entryPoints: [fileURLToPath(new URL("./vault-path.js", import.meta.url))],
			format: "cjs",
			logLevel: "silent",
			outfile,
			platform: "node",
			target: "node18",
		});

		const result = spawnSync(process.execPath, [outfile], { encoding: "utf-8" });

		assert.equal(result.status, 0, result.stderr);
		assert.doesNotMatch(result.stderr, /ERR_INVALID_URL/);
	} finally {
		await rm(rootDir, { recursive: true, force: true });
	}
});

test("registry vault paths expand a leading tilde against the configured home", async () => {
	const rootDir = await mkdtemp(
		path.join(os.tmpdir(), "tolaria-mcp-tilde-paths-"),
	);
	const configDir = path.join(rootDir, "config");
	const homeDir = path.join(rootDir, "home");
	const absoluteVault = path.join(rootDir, "Absolute Vault");
	const configPath = path.join(configDir, "com.tolaria.app", "vaults.json");

	await mkdir(path.dirname(configPath), { recursive: true });
	await writeFile(
		configPath,
		JSON.stringify({
			active_vault: "~/Primary Vault",
			vaults: [
				{
					label: "Windows separator",
					path: "~\\Secondary Vault",
					mounted: true,
				},
				{ label: "Home", path: "~", mounted: true },
				{ label: "Absolute", path: absoluteVault, mounted: true },
			],
		}),
		"utf-8",
	);

	try {
		assert.deepEqual(requireVaultPaths({}, { configDir, homeDir }), [
			path.join(homeDir, "Primary Vault"),
			path.join(homeDir, "Secondary Vault"),
			homeDir,
			absoluteVault,
		]);
	} finally {
		await rm(rootDir, { recursive: true, force: true });
	}
});
