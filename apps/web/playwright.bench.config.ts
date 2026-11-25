import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig, devices } from "@playwright/test";

// Big-vault performance bench (TOL-225): the static web bundle (`pnpm build:web` first) in
// front of a Tolaria server whose throwaway remote is seeded with 6,000 generated notes.
// Budgets live in bigVaultBudgets.ts and docs/PERFORMANCE.md.

/** A TCP port from the environment, in decimal: the ports end up in a shell command. */
function tcpPort(raw: string | undefined, fallback: number): string {
	const port = Number(raw ?? fallback);
	const valid = Number.isInteger(port) && port >= 1;
	if (valid && port <= 65_535) return String(port);
	throw new Error(`invalid TCP port: ${raw}`);
}

const repoRoot = fileURLToPath(new URL("../..", import.meta.url));
const port = tcpPort(
	new URL(process.env.BASE_URL ?? "http://127.0.0.1:41780").port || undefined,
	41780,
);
const baseURL = `http://127.0.0.1:${port}`;
const remotePort = tcpPort(process.env.TOLARIA_E2E_REMOTE_PORT, 41781);
const remoteDir = join(tmpdir(), `tolaria-web-bench-${remotePort}`);
/** The seed script adds four hand-written notes to its filler notes. */
export const BENCH_NOTE_COUNT = 6000;
const FILLER_NOTES = BENCH_NOTE_COUNT - 4;
const stagingVaultPath = process.env.TOLARIA_BENCH_VAULT_PATH;
const benchDataDir = stagingVaultPath
	? join(remoteDir, `staging-data-${process.pid}`)
	: join(remoteDir, "data");
const seedRemote = stagingVaultPath
	? ""
	: `rm -rf "${remoteDir}" && pnpm server:seed "${remoteDir}/remote.git" ${FILLER_NOTES} && `;
export const BENCH_TOKEN = "bench-token-not-a-secret-0123456789";

export default defineConfig({
	testDir: "./bench",
	outputDir: "../../test-results/web-bench-output",
	timeout: 240_000,
	retries: 0,
	workers: 1,
	reporter: [["list"]],
	use: {
		...devices["Desktop Chrome"],
		baseURL,
		headless: true,
	},
	webServer: [
		{
			command: `${seedRemote}pnpm run server`,
			cwd: repoRoot,
			url: `http://127.0.0.1:${remotePort}/healthz`,
			reuseExistingServer: false,
			timeout: 180_000,
			stdout: "pipe",
			stderr: "pipe",
			env: {
				TOLARIA_SERVER_TOKEN: BENCH_TOKEN,
				TOLARIA_SERVER_PORT: remotePort,
				TOLARIA_SERVER_DATA_DIR: benchDataDir,
				TOLARIA_VAULT_REMOTE_URL: stagingVaultPath ?? `${remoteDir}/remote.git`,
				...(stagingVaultPath ? { TOLARIA_VAULT_BRANCH: "main" } : {}),
			},
		},
		{
			command: `pnpm preview:web --port ${port}`,
			cwd: repoRoot,
			url: baseURL,
			reuseExistingServer: false,
			timeout: 30_000,
			stdout: "pipe",
			stderr: "pipe",
			env: { TOLARIA_REMOTE_URL: `http://127.0.0.1:${remotePort}` },
		},
	],
});
