/**
 * Serves the REAL Tolaria desktop UI (repo-root index.html + src/) for video capture.
 *
 * - Same Vite config as `pnpm dev` (react, tailwind, vault API, `@` alias), merged, not forked.
 * - Points the browser vault at a throwaway copy of demo-vault-v2, so anything the app
 *   writes while a clip renders never touches the tracked demo vault.
 * - Injects the video director (./director.ts) into index.html. The director lets a
 *   Remotion composition drive the app frame by frame over postMessage.
 *
 * Run from videos/: `pnpm ui` (port 5320). Nothing under src/ is changed.
 */
import { createHash } from "node:crypto";
import { cpSync, existsSync, readdirSync, rmSync, statSync, utimesSync } from "node:fs";
import path from "node:path";
import { mergeConfig, type Plugin, type UserConfig } from "vite";
import rootConfig from "../../vite.config";

const repoRoot = path.resolve(__dirname, "../..");
const vaultSource = path.join(repoRoot, "demo-vault-v2");
const vaultSnapshot = path.join(repoRoot, "videos/.vault-snapshot/demo-vault-v2");

export const TOLARIA_UI_PORT = Number(process.env.TOLARIA_UI_PORT ?? 5320);

function freshVaultSnapshot(): string {
	if (existsSync(vaultSnapshot)) rmSync(vaultSnapshot, { recursive: true, force: true });
	cpSync(vaultSource, vaultSnapshot, { recursive: true });
	pinTimestamps(vaultSnapshot);
	return vaultSnapshot;
}

/**
 * Checkout mtimes are arbitrary, and the note list sorts and labels by them. Pin every
 * file to a fixed, plausible time (seeded from its path) so each render is identical.
 */
const PINNED_NOW_S = Date.UTC(2026, 9, 28, 9, 30) / 1000;
function pinTimestamps(dir: string) {
	for (const name of readdirSync(dir)) {
		const full = path.join(dir, name);
		if (statSync(full).isDirectory()) pinTimestamps(full);
		const seed = createHash("sha1").update(path.relative(vaultSnapshot, full)).digest().readUInt32BE(0);
		const t = PINNED_NOW_S - (seed % (21 * 24)) * 3600;
		utimesSync(full, t, t);
	}
}

/**
 * Workaround (dev vault API only): scripts/vault-api-data.ts returns modifiedAt/createdAt
 * in milliseconds while the app expects seconds (mock entries and noteListHelpers use
 * `ts * 1000`), so dates render as year 58799. Normalise them on the way out.
 * Reported to Karn; delete this once the API returns seconds.
 */
function normaliseVaultTimestamps(): Plugin {
	const fix = (value: unknown): unknown => {
		if (Array.isArray(value)) return value.map(fix);
		if (value && typeof value === "object") {
			for (const [key, v] of Object.entries(value)) {
				if ((key === "modifiedAt" || key === "createdAt") && typeof v === "number" && v > 1e11) {
					Reflect.set(value, key, Math.floor(v / 1000));
				} else if (v && typeof v === "object") fix(v);
			}
		}
		return value;
	};
	return {
		name: "tolaria-video-vault-timestamps",
		enforce: "pre",
		configureServer(server) {
			server.middlewares.use((req, res, next) => {
				if (!req.url?.startsWith("/api/vault/")) return next();
				const end = res.end.bind(res) as (...args: unknown[]) => typeof res;
				res.end = ((chunk?: unknown, ...rest: unknown[]) => {
					if (typeof chunk === "string" && chunk.includes("modifiedAt")) {
						try {
							chunk = JSON.stringify(fix(JSON.parse(chunk)));
						} catch {
							// not JSON: pass through untouched
						}
					}
					return end(chunk, ...rest);
				}) as typeof res.end;
				next();
			});
		},
	};
}

/** Inline boot script: clean profile + point the mock-tauri vault at the snapshot. */
function bootScript(vaultPath: string): string {
	const flags = [
		"tolaria_welcome_dismissed",
		"tolaria:ai-agents-onboarding-dismissed",
		"tolaria:claude-code-onboarding-dismissed",
	];
	return `(() => {
  try {
    localStorage.clear(); sessionStorage.clear();
    ${flags.map((k) => `localStorage.setItem(${JSON.stringify(k)}, '1');`).join(" ")}
    localStorage.setItem('tolaria.community-banner.dismissed', 'true');
    localStorage.setItem('tolaria-theme', 'light');
  } catch (e) {}
  const vault = ${JSON.stringify(vaultPath)};
  const vaults = { vaults: [{ label: 'demo-vault-v2', path: vault }], active_vault: vault, hidden_defaults: [] };
  // Same override hook the Playwright smoke tests use (window.__mockHandlers setter).
  let ref = null;
  const patch = (h) => {
    if (!h) return h;
    h.load_vault_list = () => ({ ...vaults, vaults: [...vaults.vaults] });
    h.get_last_vault_path = () => vault;
    h.get_default_vault_path = () => vault;
    h.check_vault_exists = () => true;
    return h;
  };
  Object.defineProperty(window, '__mockHandlers', {
    configurable: true,
    set(value) { ref = patch(value); },
    get() { return ref; },
  });
})();`;
}

function videoDirectorPlugin(vaultPath: string): Plugin {
	return {
		name: "tolaria-video-director",
		transformIndexHtml: {
			order: "pre",
			handler: () => [
				{ tag: "script", injectTo: "head-prepend", children: bootScript(vaultPath) },
				{
					tag: "script",
					attrs: { type: "module", src: "/videos/real-ui/director.ts" },
					injectTo: "body",
				},
			],
		},
	};
}

const snapshotPath = freshVaultSnapshot();

const videoConfig: UserConfig = {
	root: repoRoot,
	cacheDir: path.join(repoRoot, "videos/.vite"),
	plugins: [normaliseVaultTimestamps(), videoDirectorPlugin(snapshotPath)],
	define: { __DEMO_VAULT_PATH__: JSON.stringify(snapshotPath) },
	server: {
		port: TOLARIA_UI_PORT,
		strictPort: true,
		cors: true,
		hmr: false,
		watch: { ignored: ["**/videos/.vault-snapshot/**", "**/videos/.vite/**", "**/videos/node_modules/**", "**/videos/src/**", "**/demo-vault-v2/**"] },
	},
};

export default mergeConfig(rootConfig as UserConfig, videoConfig);
