import { afterEach, beforeEach, expect, it, vi } from "vitest";
import {
	readCache,
	writeCache,
} from "../../../packages/collab-client/src/entriesCache";
import type { VaultEntry as ProtocolEntry } from "../../../packages/protocol/src/index";

vi.mock(
	"../../../packages/collab-client/src/entriesCache",
	async (importOriginal) => ({
		...(await importOriginal<
			typeof import("../../../packages/collab-client/src/entriesCache")
		>()),
		readCache: vi.fn(),
		writeCache: vi.fn(async () => {}),
	}),
);

const STALE_EVENT = "tolaria:vault-entries-stale";

function entry(path: string): ProtocolEntry {
	return {
		path,
		filename: path,
		title: path,
		fileSize: 1,
		snippet: "",
		wordCount: 0,
		hasH1: true,
		fileKind: "markdown",
	};
}

async function cachedBackend(changed: ProtocolEntry[]) {
	vi.stubGlobal("indexedDB", {});
	vi.mocked(readCache).mockResolvedValue({
		head: "h1",
		entries: [entry("heron.md")],
	} as Awaited<ReturnType<typeof readCache>>);
	const { createRemoteVaultBackend } = await import(
		"../../../packages/collab-client/src/remoteVaultBackend"
	);
	return createRemoteVaultBackend({
		baseUrl: "https://vault.example",
		token: "token-for-tests",
		fetch: (async () =>
			new Response(JSON.stringify({ head: "h2", changed, deleted: [] }), {
				headers: { "content-type": "application/json" },
			})) as typeof fetch,
	});
}

beforeEach(() => {
	vi.resetModules();
	vi.mocked(readCache).mockReset();
	vi.mocked(writeCache).mockClear();
});

afterEach(() => {
	vi.unstubAllGlobals();
});

it("asks the web vault to reload entries after a cached delta updates", async () => {
	const onStale = vi.fn();
	window.addEventListener(STALE_EVENT, onStale);
	const backend = await cachedBackend([entry("heron.md")]);

	await backend.files.list();
	await vi.waitFor(() => expect(writeCache).toHaveBeenCalled());
	await vi.waitFor(() => expect(onStale).toHaveBeenCalledTimes(1));

	window.removeEventListener(STALE_EVENT, onStale);
});
