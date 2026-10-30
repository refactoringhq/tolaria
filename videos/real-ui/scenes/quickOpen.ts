import type { DirectorContext, Scene } from "./types";
import { QUICK_OPEN as T } from "./quickOpen.timeline";

const PALETTE = '[data-testid="quick-open-palette"]';
const PALETTE_INPUT = `${PALETTE} input`;
const PANEL = `${PALETTE} > div.relative`;
const rf = (t: number) => 1 - (1 - Math.min(1, Math.max(0, t))) ** 3.2;

async function openPalette(ctx: DirectorContext) {
	ctx.appCommand("file-quick-open");
	return ctx.waitFor(() => ctx.$<HTMLInputElement>(PALETTE_INPUT), "quick open input");
}

function editorHeading(text: string) {
	const lower = text.toLowerCase();
	return () => Array.from(document.querySelectorAll(".bn-editor h1, .bn-editor [data-content-type='heading']"))
		.find((el) => el.textContent?.toLowerCase().includes(lower)) ?? null;
}

export const quickOpenScene: Scene = {
	async setup(ctx) {
		await ctx.waitFor(() => (window as unknown as { __laputaTest?: unknown }).__laputaTest, "app bridge", 60_000);
		await ctx.waitFor(() => document.querySelectorAll("[data-testid='note-list-container'] *, .note-list *").length > 0 || document.body.innerText.includes("Inbox"), "app shell", 60_000);
		await ctx.settle(300, 8_000);
		const input = await openPalette(ctx);
		await ctx.sleep(80);
		ctx.setInputValue(input, T.startNoteQuery);
		await ctx.settle();
		ctx.pressKey("Enter");
		await ctx.waitFor(editorHeading("writing for clarity"), "starting note in editor", 20_000);
		await ctx.settle(300, 8_000);
	},
	events: [
		{ frame: T.open, run: async (ctx) => { await openPalette(ctx); await ctx.sleep(80); } },
		...T.typeFrames.map((frame, i) => ({
			frame,
			run: (ctx: DirectorContext) => {
				const input = ctx.$<HTMLInputElement>(PALETTE_INPUT);
				if (input) ctx.setInputValue(input, T.query.slice(0, i + 1));
			},
		})),
		...T.arrowDown.map((frame) => ({ frame, run: (ctx: DirectorContext) => ctx.pressKey("ArrowDown") })),
		{
			frame: T.enter,
			run: async (ctx) => {
				ctx.pressKey("Enter");
				await ctx.waitFor(editorHeading("sponsor onboarding"), "picked note in editor", 20_000);
			},
		},
	],
	style(frame, ctx) {
		// Palette entrance, frame-driven: backdrop fades, panel rises + settles (house ease).
		const root = ctx.$(PALETTE);
		const panel = ctx.$(PANEL);
		if (!root || !panel) return;
		const p = rf((frame - T.open) / 12);
		root.style.backgroundColor = `color-mix(in srgb, var(--shadow-dialog) ${Math.round(p * 100)}%, transparent)`;
		panel.style.opacity = String(Math.min(1, (frame - T.open + 1) / 6));
		panel.style.transform = `translateY(${(1 - p) * 14}px) scale(${0.97 + 0.03 * p})`;
	},
	measure: () => ({
		palette: PANEL,
		selected: `${PALETTE} .bg-accent`,
		selectedTitle: () => {
			// The title text itself (not its flex box), so the drawn circle hugs the words.
			const span = document.querySelector(`${PALETTE} .bg-accent span.truncate`);
			if (!span?.firstChild) return null;
			const range = document.createRange();
			range.selectNodeContents(span);
			return range;
		},
		editorTitle: editorHeading("sponsor onboarding"),
	}),
};
