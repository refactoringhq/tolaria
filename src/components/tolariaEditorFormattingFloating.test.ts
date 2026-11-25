import { afterEach, describe, expect, it, vi } from "vitest";
import { withViewportSafeMiddleware } from "./tolariaEditorFormattingFloating";

type ClampState = Parameters<
	NonNullable<
		ReturnType<typeof withViewportSafeMiddleware>["middleware"]
	>[number] extends infer M
		? M extends { fn: (state: infer S) => unknown }
			? (state: S) => unknown
			: never
		: never
>[0];

function clamp(state: {
	x: number;
	floatingWidth: number;
	referenceX: number;
	referenceViewportX: number;
}) {
	const middleware = withViewportSafeMiddleware().middleware?.find(
		(entry) => entry.name === "tolariaViewportClamp",
	);
	if (!middleware) throw new Error("no viewport clamp");
	return middleware.fn({
		x: state.x,
		y: 0,
		rects: {
			floating: { width: state.floatingWidth },
			reference: { x: state.referenceX },
		},
		elements: {
			reference: {
				getBoundingClientRect: () => ({ x: state.referenceViewportX }),
			},
		},
	} as unknown as ClampState);
}

describe("formatting toolbar viewport clamp", () => {
	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it("keeps a toolbar inside an offset editor within the right edge of a phone (TOL-419)", () => {
		vi.stubGlobal("visualViewport", { width: 393 });
		// The editor sits 16 px in from the screen: floating coordinates start there.
		expect(
			clamp({
				x: 0,
				floatingWidth: 377,
				referenceX: 100,
				referenceViewportX: 116,
			}),
		).toEqual({ x: -8 });
	});

	it("keeps a toolbar 8 px from the left edge", () => {
		vi.stubGlobal("visualViewport", { width: 1200 });
		expect(
			clamp({
				x: -40,
				floatingWidth: 300,
				referenceX: 0,
				referenceViewportX: 16,
			}),
		).toEqual({ x: -8 });
	});

	it("leaves a toolbar that fits where it is", () => {
		vi.stubGlobal("visualViewport", undefined);
		vi.stubGlobal("innerWidth", 1200);
		expect(
			clamp({
				x: 200,
				floatingWidth: 300,
				referenceX: 50,
				referenceViewportX: 250,
			}),
		).toEqual({ x: 200 });
	});
});
