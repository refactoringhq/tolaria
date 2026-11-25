import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { type BrowserContext, expect, type Page, test } from "@playwright/test";
import {
	type BigVaultMeasurements,
	evaluateBudgets,
	formatBenchReport,
} from "../bigVaultBudgets";
import { BENCH_NOTE_COUNT, BENCH_TOKEN } from "../playwright.bench.config";

/**
 * Big-vault performance bench (TOL-225): one browser session against a 6,000-note vault.
 * It opens the vault cold (no cache), reloads it warm (cache first, background reload),
 * opens a note, types into it and searches, then checks every number against its budget.
 */

const REPORT_DIR = join(process.cwd(), "test-results", "web-bench");
/** How long the last warm open is watched for long tasks: the background reload runs in it. */
const SETTLE_MS = 5_000;
const TYPED_TEXT = " the quick brown fox jumps over the lazy dog";
const SEARCH_QUERY = "4321";
const SEARCH_TITLE = "Filler 4321";
const WARM_OPENS = 3;
const STARTUP_ONLY = process.env.TOLARIA_BENCH_STARTUP_ONLY === "1";

interface LongTask {
	start: number;
	duration: number;
}

declare global {
	interface Window {
		__tolariaBench: {
			longTasks: LongTask[];
			keyLatencies: number[];
			recordKeys: boolean;
		};
	}
}

/** Collects long tasks from navigation start, and keystroke-to-next-frame latencies. */
function installProbes(): void {
	const bench = { longTasks: [], keyLatencies: [], recordKeys: false };
	window.__tolariaBench = bench;
	new PerformanceObserver((list) => {
		for (const entry of list.getEntries())
			bench.longTasks.push({
				start: entry.startTime,
				duration: entry.duration,
			});
	}).observe({ type: "longtask", buffered: true });
	window.addEventListener(
		"keydown",
		(event) => {
			if (!bench.recordKeys) return;
			const start = event.timeStamp;
			requestAnimationFrame(() => {
				const channel = new MessageChannel();
				channel.port1.onmessage = () =>
					bench.keyLatencies.push(performance.now() - start);
				channel.port2.postMessage(null);
			});
		},
		true,
	);
}

async function preparePage(page: Page): Promise<void> {
	await page.addInitScript((token) => {
		window.TOLARIA_REMOTE_URL = window.location.origin;
		window.TOLARIA_REMOTE_TOKEN = token;
		window.localStorage.setItem(
			"tolaria:claude-code-onboarding-dismissed",
			"1",
		);
	}, BENCH_TOKEN);
	await page.addInitScript(installProbes);
}

/** When the note list first had rows on screen, from the shell's own mark (TOL-206). */
async function noteListPaintedAt(page: Page): Promise<number> {
	await page.waitForFunction(
		() => performance.getEntriesByName("tolaria:note_list_painted").length > 0,
		null,
		{ timeout: 60_000 },
	);
	return page.evaluate(
		() =>
			performance.getEntriesByName("tolaria:note_list_painted")[0].startTime,
	);
}

async function cacheSnapshotCount(page: Page): Promise<number> {
	return page.evaluate(async () => {
		const db = await new Promise<IDBDatabase | null>((resolve) => {
			const request = indexedDB.open("tolaria-entries", 1);
			request.onsuccess = () => resolve(request.result);
			request.onerror = () => resolve(null);
		});
		if (!db) return 0;
		const count = await new Promise<number>((resolve) => {
			const request = db
				.transaction("entries", "readonly")
				.objectStore("entries")
				.get("snapshot");
			request.onsuccess = () => resolve(request.result?.entries?.length ?? 0);
			request.onerror = () => resolve(0);
		});
		db.close();
		return count;
	});
}

/** Waits until the cache snapshot holds every note, so the reload is warm. */
async function waitForFullCacheSnapshot(page: Page): Promise<number> {
	await expect
		.poll(() => cacheSnapshotCount(page), { timeout: 60_000 })
		.toBeGreaterThanOrEqual(BENCH_NOTE_COUNT);
	return cacheSnapshotCount(page);
}

/** Confirms the first rendered row title exists in the cached vault snapshot. */
async function expectFirstRowFromCache(page: Page): Promise<void> {
	const row = page
		.getByTestId("note-list-container")
		.locator("[data-note-path]")
		.first();
	const path = await row.getAttribute("data-note-path");
	expect(path).toBeTruthy();
	const title = await page.evaluate(async (notePath) => {
		const db = await new Promise<IDBDatabase | null>((resolve) => {
			const request = indexedDB.open("tolaria-entries", 1);
			request.onsuccess = () => resolve(request.result);
			request.onerror = () => resolve(null);
		});
		if (!db) return null;
		const cachedTitle = await new Promise<string | null>((resolve) => {
			const request = db
				.transaction("entries", "readonly")
				.objectStore("entries")
				.get("snapshot");
			request.onsuccess = () => {
				const entry = request.result?.entries?.find(
					(candidate: { path: string }) => candidate.path === notePath,
				);
				resolve(typeof entry?.title === "string" ? entry.title : null);
			};
			request.onerror = () => resolve(null);
		});
		db.close();
		return cachedTitle;
	}, path);
	expect(title).toBeTruthy();
	await expect(
		page
			.getByTestId("note-list-container")
			.getByText(title as string, { exact: true }),
	).toBeVisible();
}

/** The longest main-thread task and the total blocking time (time over 50 ms) so far. */
async function longTaskSummary(
	page: Page,
	since = 0,
): Promise<{ maxMs: number; blockingMs: number }> {
	const tasks = await page.evaluate(
		(from) => window.__tolariaBench.longTasks.filter((t) => t.start >= from),
		since,
	);
	return {
		maxMs: Math.max(0, ...tasks.map((task) => task.duration)),
		blockingMs: tasks.reduce((sum, task) => sum + task.duration - 50, 0),
	};
}

async function usedHeapMb(
	context: BrowserContext,
	page: Page,
): Promise<number> {
	const client = await context.newCDPSession(page);
	await client.send("HeapProfiler.collectGarbage");
	const { usedSize } = await client.send("Runtime.getHeapUsage");
	await client.detach();
	return usedSize / (1024 * 1024);
}

async function pageNow(page: Page): Promise<number> {
	return page.evaluate(() => performance.now());
}

/** Fast 4G profile shared with the cache-first startup acceptance test. */
async function applyFast4G(context: BrowserContext, page: Page): Promise<void> {
	if (context.browser()?.browserType().name() !== "chromium") return;
	const client = await context.newCDPSession(page);
	await client.send("Network.emulateNetworkConditions", {
		offline: false,
		downloadThroughput: (4 * 1024 * 1024) / 8,
		uploadThroughput: (3 * 1024 * 1024) / 8,
		latency: 20,
	});
	await client.detach();
}

/** From the click on a note row to its body on screen in the editor. */
async function openNoteMs(page: Page, title: string): Promise<number> {
	const row = page
		.getByTestId("note-list-container")
		.getByText(title, { exact: true })
		.first();
	await expect(row).toBeVisible({ timeout: 30_000 });
	const started = Date.now();
	await row.click();
	await expect(
		page.locator(".bn-editor").getByText("so listing and search run").first(),
	).toBeVisible({ timeout: 30_000 });
	return Date.now() - started;
}

function percentile(values: number[], fraction: number): number {
	const sorted = [...values].sort((a, b) => a - b);
	return sorted[
		Math.min(sorted.length - 1, Math.floor(sorted.length * fraction))
	];
}

async function typingLatency(page: Page) {
	await page.locator(".bn-editor .bn-inline-content").last().click();
	await page.keyboard.press("End");
	const since = await pageNow(page);
	await page.evaluate(() => {
		window.__tolariaBench.recordKeys = true;
	});
	await page.keyboard.type(TYPED_TEXT, { delay: 40 });
	await expect(page.locator(".bn-editor")).toContainText(TYPED_TEXT.trim());
	await page.waitForTimeout(500);
	const latencies = await page.evaluate(() => {
		window.__tolariaBench.recordKeys = false;
		return window.__tolariaBench.keyLatencies;
	});
	expect(latencies.length).toBe(TYPED_TEXT.length);
	return {
		p50: percentile(latencies, 0.5),
		p95: percentile(latencies, 0.95),
		longTasks: await longTaskSummary(page, since),
	};
}

/** From the query landing in the search box to its matching result on screen. */
async function searchMs(page: Page): Promise<number> {
	await page.locator("body").click();
	await page.keyboard.press("Control+Shift+F");
	const input = page.locator('input[placeholder="Search in all notes..."]');
	await expect(input).toBeVisible({ timeout: 10_000 });
	const started = Date.now();
	await input.fill(SEARCH_QUERY);
	await expect(
		page
			.getByRole("listbox", { name: "Search results" })
			.getByText(SEARCH_TITLE, { exact: true }),
	).toBeVisible({ timeout: 30_000 });
	return Date.now() - started;
}

async function writeReport(
	measurements: BigVaultMeasurements,
	report: string,
): Promise<void> {
	await mkdir(REPORT_DIR, { recursive: true });
	const json = { noteCount: BENCH_NOTE_COUNT, measurements };
	await writeFile(
		join(REPORT_DIR, "big-vault.json"),
		`${JSON.stringify(json, null, 2)}\n`,
	);
	await writeFile(join(REPORT_DIR, "big-vault.md"), `${report}\n`);
}

type OpenMeasurements = Pick<
	BigVaultMeasurements,
	| "coldOpenMs"
	| "coldMaxLongTaskMs"
	| "warmOpenMs"
	| "warmMaxLongTaskMs"
	| "warmBlockingMs"
	| "heapMb"
>;

interface OpenBenchResult extends OpenMeasurements {
	cacheEntryCount: number;
}

/** Cold open with an empty cache, then warm opens from the cache it wrote. */
async function measureOpens(
	context: BrowserContext,
	page: Page,
): Promise<OpenBenchResult> {
	await page.goto("/");
	const coldOpenMs = await noteListPaintedAt(page);
	const cacheEntryCount = await waitForFullCacheSnapshot(page);
	// A returning user has completed the first visit: both the entry snapshot and the
	// service worker's versioned shell precache are ready before Fast 4G is applied.
	await page.waitForLoadState("networkidle");
	await page.evaluate(async () => {
		if ("serviceWorker" in navigator) await navigator.serviceWorker.ready;
	});
	const cold = await longTaskSummary(page);

	const warmOpens: number[] = [];
	await page.setViewportSize({ width: 390, height: 844 });
	await applyFast4G(context, page);
	for (let open = 0; open < WARM_OPENS; open++) {
		await page.reload();
		warmOpens.push(await noteListPaintedAt(page));
	}
	await expectFirstRowFromCache(page);
	const proofDir = process.env.TOLARIA_BENCH_PROOF_DIR;
	if (proofDir) {
		await mkdir(proofDir, { recursive: true });
		await page.screenshot({
			path: join(proofDir, "cached-note-list.png"),
			fullPage: false,
		});
		await writeFile(
			join(proofDir, "warm-paint-ms.txt"),
			`${warmOpens.join(" ms, ")} ms\n`,
		);
	}
	await page.waitForTimeout(SETTLE_MS);
	const warm = await longTaskSummary(page);
	return {
		coldOpenMs,
		coldMaxLongTaskMs: cold.maxMs,
		warmOpenMs: percentile(warmOpens, 0.5),
		warmMaxLongTaskMs: warm.maxMs,
		warmBlockingMs: warm.blockingMs,
		heapMb: await usedHeapMb(context, page),
		cacheEntryCount,
	};
}

async function writeStartupReport(
	measurements: OpenBenchResult,
): Promise<string> {
	const report = [
		`### Cached note-list paint (${measurements.cacheEntryCount} cached entries)`,
		"",
		"| Metric | Measured | Budget | Result |",
		"| --- | --- | --- | --- |",
		`| Cold open: note list painted | ${Math.round(measurements.coldOpenMs)} ms | no cap | recorded |`,
		`| Warm open: cached note list painted, median of 3 | ${Math.round(measurements.warmOpenMs)} ms | 1,000 ms | ${measurements.warmOpenMs <= 1000 ? "ok" : "OVER BUDGET"} |`,
		`| Warm open + background reload: longest task | ${Math.round(measurements.warmMaxLongTaskMs)} ms | 400 ms | recorded |`,
		"",
		"Browser: Chromium, 390 × 844 CSS px mobile viewport.",
		"Network: Fast 4G profile, 4 Mbit/s down, 3 Mbit/s up, 20 ms latency.",
		"Warm reload began after the full IndexedDB entry snapshot and service-worker shell cache were ready.",
	].join("\n");
	await mkdir(REPORT_DIR, { recursive: true });
	await writeFile(join(REPORT_DIR, "startup.md"), `${report}\n`);
	return report;
}

async function measureInteractions(
	page: Page,
): Promise<Omit<BigVaultMeasurements, keyof OpenMeasurements>> {
	const noteOpenMs = await openNoteMs(page, "Filler 1");
	const typing = await typingLatency(page);
	return {
		noteOpenMs,
		typingP50Ms: typing.p50,
		typingP95Ms: typing.p95,
		typingMaxLongTaskMs: typing.longTasks.maxMs,
		searchMs: await searchMs(page),
	};
}

test("a 6,000-note vault opens, searches and types within budget", async ({
	context,
	page,
}) => {
	await preparePage(page);
	const opens = await measureOpens(context, page);
	if (STARTUP_ONLY) {
		const report = await writeStartupReport(opens);
		process.stdout.write(`\n${report}\n\n`);
		expect(opens.warmOpenMs).toBeLessThanOrEqual(1000);
		return;
	}
	const measurements: BigVaultMeasurements = {
		...opens,
		...(await measureInteractions(page)),
	};
	const results = evaluateBudgets(measurements);
	const report = formatBenchReport(results, BENCH_NOTE_COUNT);
	await writeReport(measurements, report);
	process.stdout.write(`\n${report}\n\n`);
	const overBudget = results.filter((result) => !result.withinBudget);
	expect(overBudget.map((result) => result.label)).toEqual([]);
});
