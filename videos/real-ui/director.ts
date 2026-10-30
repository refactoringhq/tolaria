/**
 * Video director: runs inside the real Tolaria app (injected by ./vite.config.ts).
 *
 * A Remotion composition (videos/src/components/TolariaApp.tsx) embeds the app in an
 * iframe (`?scene=<id>&parent=<remotion origin>`) and, for every frame it renders, posts
 * `{ type: 'tolaria-video:frame', frame }`. Messages are origin-checked both ways.
 * The director moves the app to exactly that frame's state, waits for React/BlockNote
 * to settle, measures any named regions the scene asks for, and replies
 * `{ type: 'tolaria-video:ready', frame, rects }`. Remotion only screenshots after that.
 *
 * Determinism:
 * - Scenes are lists of discrete UI events (open palette, set the query, press a key)
 *   pinned to frame numbers, plus a pure per-frame `style(frame)` pass.
 * - Events are applied in order and awaited; nothing is driven by wall-clock time.
 * - CSS transitions/animations and the caret blink are disabled; motion comes from frames.
 * - Seeking backwards reloads the page (the profile is reset on boot), then replays.
 */
import { scenes } from "./scenes";
import type { DirectorContext, Scene } from "./scenes/types";

declare global {
	interface Window {
		__tolariaVideo?: { apply: (frame: number) => Promise<Record<string, Rect>> };
	}
}

type Rect = { x: number; y: number; width: number; height: number };

const params = new URLSearchParams(location.search);
const sceneId = params.get("scene") ?? "quick-open";
const scene: Scene | undefined = scenes[sceneId];

const FREEZE_CSS = `
*, *::before, *::after {
  transition: none !important;
  animation: none !important;
  caret-color: transparent !important;
  scroll-behavior: auto !important;
}
::-webkit-scrollbar { display: none !important; }
`;

function installFreezeStyles() {
	const style = document.createElement("style");
	style.dataset.tolariaVideo = "freeze";
	style.textContent = FREEZE_CSS + (scene?.css ?? "");
	document.head.appendChild(style);
}

const nextPaint = () =>
	new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

async function waitFor<T>(probe: () => T | null | undefined | false, label: string, timeoutMs = 15_000): Promise<T> {
	const started = performance.now();
	for (;;) {
		const value = probe();
		if (value) return value;
		if (performance.now() - started > timeoutMs) throw new Error(`[tolaria-video] timed out waiting for ${label}`);
		await sleep(16);
	}
}

const $ = <E extends Element = HTMLElement>(selector: string) => document.querySelector<E>(selector);

function setInputValue(input: HTMLInputElement, value: string) {
	if (input.value === value) return;
	const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
	setter?.call(input, value);
	input.dispatchEvent(new Event("input", { bubbles: true }));
}

function pressKey(key: string, init: KeyboardEventInit = {}) {
	const target = document.activeElement instanceof HTMLElement ? document.activeElement : document.body;
	target.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true, ...init }));
}

function appCommand(id: string) {
	const bridge = (window as unknown as { __laputaTest?: { dispatchAppCommand(id: string): void } }).__laputaTest;
	if (!bridge) throw new Error("[tolaria-video] __laputaTest bridge missing");
	bridge.dispatchAppCommand(id);
}

/** Settle: two paints, then until the DOM stops mutating for a couple of frames. */
async function settle(quietMs = 60, timeoutMs = 4_000) {
	await nextPaint();
	let last = performance.now();
	const observer = new MutationObserver(() => { last = performance.now(); });
	observer.observe(document.body, { subtree: true, childList: true, attributes: true, characterData: true });
	const started = performance.now();
	while (performance.now() - last < quietMs && performance.now() - started < timeoutMs) await sleep(16);
	observer.disconnect();
	await nextPaint();
}

const ctx: DirectorContext = { $, waitFor, setInputValue, pressKey, appCommand, settle, sleep, nextPaint };

let applied = 0;
let lastFrame = -1;
let queue: Promise<unknown> = Promise.resolve();

function rectOf(el: Element | Range | null): Rect | null {
	if (!el) return null;
	const r = el.getBoundingClientRect();
	return { x: r.x, y: r.y, width: r.width, height: r.height };
}

async function applyFrame(frame: number): Promise<Record<string, Rect>> {
	if (!scene) throw new Error(`[tolaria-video] unknown scene ${sceneId}`);
	if (frame < lastFrame) {
		location.reload();
		return new Promise(() => {});
	}
	lastFrame = frame;
	let changed = false;
	while (applied < scene.events.length && scene.events[applied].frame <= frame) {
		await scene.events[applied].run(ctx);
		applied += 1;
		changed = true;
	}
	if (changed) await settle();
	scene.style?.(frame, ctx);
	await nextPaint();
	const rects: Record<string, Rect> = {};
	for (const [name, selector] of Object.entries(scene.measure?.(frame) ?? {})) {
		const rect = rectOf(typeof selector === "string" ? $(selector) : selector());
		if (rect) rects[name] = rect;
	}
	return rects;
}

function apply(frame: number) {
	const run = queue.then(() => applyFrame(frame));
	queue = run.catch(() => undefined);
	return run;
}

/**
 * The only window allowed to drive the director: the Remotion page that embeds us.
 * It passes its origin as `?parent=`; we accept it only if it is a loopback http(s)
 * origin and (where the browser exposes it) matches the real embedding origin.
 * Every message in or out is pinned to this origin; nothing uses a wildcard.
 */
const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

function expectedParentOrigin(): string | null {
	if (window.parent === window) return null;
	const requested = params.get("parent");
	if (!requested) return null;
	let origin: string;
	try {
		const url = new URL(requested);
		if (url.protocol !== "http:" && url.protocol !== "https:") return null;
		if (!LOOPBACK_HOSTS.has(url.hostname)) return null;
		origin = url.origin;
	} catch {
		return null;
	}
	const embedding = location.ancestorOrigins?.[0];
	if (embedding && embedding !== origin) return null;
	return origin;
}

const parentOrigin = expectedParentOrigin();

function postToParent(message: Record<string, unknown>) {
	if (!parentOrigin) return;
	window.parent.postMessage(message, parentOrigin);
}

function onParentMessage(event: MessageEvent) {
	if (!parentOrigin || event.origin !== parentOrigin || event.source !== window.parent) return;
	const data = event.data as { type?: string; frame?: number } | null;
	if (data?.type !== "tolaria-video:frame" || typeof data.frame !== "number") return;
	const frame = data.frame;
	apply(frame).then(
		(rects) => postToParent({ type: "tolaria-video:ready", frame, rects }),
		(error) => postToParent({ type: "tolaria-video:error", frame, message: String(error) }),
	);
}

async function boot() {
	installFreezeStyles();
	if (!scene) throw new Error(`[tolaria-video] unknown scene ${sceneId}`);
	if (!parentOrigin && window.parent !== window) {
		console.warn("[tolaria-video] no valid ?parent= origin: frame messages are ignored");
	}
	await scene.setup(ctx);
	await settle(150);
	window.__tolariaVideo = { apply };
	window.addEventListener("message", onParentMessage);
	postToParent({ type: "tolaria-video:boot", scene: sceneId });
	document.documentElement.dataset.tolariaVideoReady = "true";
}

boot().catch((error) => {
	console.error(error);
	postToParent({ type: "tolaria-video:error", frame: -1, message: String(error) });
});
