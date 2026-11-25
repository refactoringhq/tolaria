import type { FloatingUIOptions } from "@blocknote/react";
import { flip, offset, shift } from "@floating-ui/dom";

const FORMATTER_VIEWPORT_PADDING_PX = 8;
type TolariaFloatingOptions = NonNullable<
	FloatingUIOptions["useFloatingOptions"]
>;
type TolariaFloatingMiddleware = NonNullable<
	TolariaFloatingOptions["middleware"]
>[number];

interface ViewportClampState {
	x: number;
	rects: { floating: { width: number }; reference: { x: number } };
	elements: { reference: { getBoundingClientRect: () => { x: number } } };
}

/**
 * Keeps the toolbar 8 px inside the screen. Floating coordinates start at the editor's offset
 * parent, not at the screen's edge, so the clamp converts them first (TOL-419).
 */
function viewportClampMiddleware(): TolariaFloatingMiddleware {
	return {
		name: "tolariaViewportClamp",
		fn({ x, rects, elements }: ViewportClampState) {
			const originX =
				elements.reference.getBoundingClientRect().x - rects.reference.x;
			const viewportWidth = window.visualViewport?.width ?? window.innerWidth;
			const minX = FORMATTER_VIEWPORT_PADDING_PX;
			const maxX = Math.max(
				minX,
				viewportWidth - rects.floating.width - FORMATTER_VIEWPORT_PADDING_PX,
			);

			return {
				x: Math.min(Math.max(x + originX, minX), maxX) - originX,
			};
		},
	};
}

export function withViewportSafeMiddleware(
	options?: TolariaFloatingOptions,
): TolariaFloatingOptions {
	return {
		...options,
		middleware: [
			offset(10),
			shift(),
			flip(),
			...(options?.middleware ?? []),
			viewportClampMiddleware(),
		],
	};
}
