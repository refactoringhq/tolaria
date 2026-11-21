import {
	useCallback,
	useEffect,
	useLayoutEffect,
	useRef,
	useState,
} from "react";

import type { StackMeasure } from "./calendarLanes";

const UNMEASURED: StackMeasure = { available: 0, heights: new Map() };
const ZOOM_EVENT = "laputa-zoom-change";

/** Every card in the row, shown or measured-only, carries its note's `data-path`. */
function readCards(container: HTMLElement): StackMeasure {
	const heights = new Map<string, number>();
	for (const card of container.querySelectorAll<HTMLElement>("[data-path]")) {
		heights.set(card.dataset.path ?? "", card.offsetHeight);
	}
	return { available: container.clientHeight, heights };
}

function sameMeasure(left: StackMeasure, right: StackMeasure): boolean {
	return (
		left.available === right.available &&
		left.heights.size === right.heights.size &&
		[...left.heights].every(
			([path, height]) => right.heights.get(path) === height,
		)
	);
}

/**
 * Measures after every render, before paint, so a row never flashes with a guessed fit, and again when the
 * row resizes (window resize, zoom) or the app zoom changes.
 */
export function useLaneMeasure() {
	const ref = useRef<HTMLDivElement | null>(null);
	const [measure, setMeasure] = useState<StackMeasure>(UNMEASURED);
	const remeasure = useCallback(() => {
		const container = ref.current;
		if (!container) return;
		const next = readCards(container);
		setMeasure((current) => (sameMeasure(current, next) ? current : next));
	}, []);
	useLayoutEffect(remeasure);
	useEffect(() => {
		const container = ref.current;
		const onZoom = () => requestAnimationFrame(remeasure);
		window.addEventListener(ZOOM_EVENT, onZoom);
		const observer =
			typeof ResizeObserver === "undefined"
				? null
				: new ResizeObserver(remeasure);
		if (container) observer?.observe(container);
		return () => {
			window.removeEventListener(ZOOM_EVENT, onZoom);
			observer?.disconnect();
		};
	}, [remeasure]);
	return [ref, measure] as const;
}
