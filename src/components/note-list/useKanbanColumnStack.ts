import { type CollisionDetection, useDndContext } from "@dnd-kit/core";
import { type RefObject, useLayoutEffect } from "react";
import { listenForBoardWheel } from "./kanbanBoardWheel";
import { columnId, isCardId } from "./kanbanModel";
import { kanbanCollisionDetection } from "./useKanbanDrag";

const COLUMN_SELECTOR = "[data-kanban-column]";
const MAX_STACK_OVERHANG = 12;
const DECK_POSES = [
	{ angle: -2.3, x: -5, y: 4 },
	{ angle: 1.8, x: 4, y: -3 },
	{ angle: -1.2, x: 5, y: 3 },
	{ angle: 2.5, x: -4, y: 5 },
	{ angle: 0.9, x: 2, y: -4 },
	{ angle: -1.7, x: -3, y: 2 },
];

function observeStack(
	board: HTMLElement,
	elements: HTMLElement[],
	refresh: () => void,
) {
	let frame = 0;
	const schedule = () => {
		if (frame) return;
		frame = requestAnimationFrame(() => {
			frame = 0;
			refresh();
		});
	};
	const observer =
		typeof ResizeObserver !== "undefined" ? new ResizeObserver(schedule) : null;
	for (const element of elements) observer?.observe(element);
	board.addEventListener("scroll", schedule, { passive: true });
	return () => {
		cancelAnimationFrame(frame);
		observer?.disconnect();
		board.removeEventListener("scroll", schedule);
	};
}

function positionColumn(
	column: HTMLElement,
	edge: "left" | "right" | "moving",
	fan: number,
	layer: number,
	columnHeight: number,
) {
	const pose = DECK_POSES[Math.max(0, layer - 1) % DECK_POSES.length];
	const x = pose.x * fan;
	// Keep the small stagger at the top and cap the extra swing from the rotation.
	const maxAngle =
		((MAX_STACK_OVERHANG - Math.abs(x)) * 180) / (columnHeight * Math.PI);
	const angle =
		Math.sign(pose.angle) * Math.min(Math.abs(pose.angle * fan), maxAngle);
	column.dataset.kanbanStack = edge;
	column.style.setProperty("--kanban-stack-angle", `${angle}deg`);
	column.style.setProperty("--kanban-stack-shift", `${x}px ${pose.y * fan}px`);
	column.style.setProperty("--kanban-stack-layer", String(layer));
}

function measureColumnSlots(
	board: HTMLElement,
	track: HTMLElement,
	columns: HTMLElement[],
) {
	const padding = getComputedStyle(board);
	const left = Number.parseFloat(padding.paddingLeft);
	const right = board.clientWidth - Number.parseFloat(padding.paddingRight);
	const gap = Number.parseFloat(getComputedStyle(track).columnGap);
	let start = left - Math.max(0, board.scrollLeft);
	// Sticky columns keep their original slots in the flex row.
	const positions = columns.map((column) => {
		const width = column.offsetWidth;
		const visibleStart = Math.max(left, Math.min(start, right - width));
		const position = { column, start, end: start + width, width, visibleStart };
		start = position.end + gap;
		return position;
	});
	return { left, right, positions };
}

type ColumnSlot = ReturnType<typeof measureColumnSlots>["positions"][number];

function overlapWidth(slot: ColumnSlot, neighbor?: ColumnSlot) {
	if (!neighbor) return 0;
	const left = Math.max(slot.visibleStart, neighbor.visibleStart);
	const right = Math.min(
		slot.visibleStart + slot.width,
		neighbor.visibleStart + neighbor.width,
	);
	return right - left;
}

function updateColumnStack(
	board: HTMLElement,
	track: HTMLElement,
	columns: HTMLElement[],
) {
	const { left, right, positions } = measureColumnSlots(board, track, columns);
	const columnHeight = track.clientHeight;
	const widest = Math.max(...positions.map(({ width }) => width), 0);
	const canStack =
		track.offsetWidth > right - left && right - left >= 2 * widest;
	board.toggleAttribute("data-kanban-stacking", canStack);
	if (!canStack) {
		for (const column of columns)
			positionColumn(column, "moving", 0, 0, columnHeight);
		return;
	}

	let previous: ColumnSlot | undefined;
	positions.forEach((slot, index) => {
		const { column, start, end, width } = slot;
		const next = positions.at(index + 1);
		const overlap = Math.max(
			0,
			overlapWidth(slot, previous),
			overlapWidth(slot, next),
		);
		column.style.setProperty(
			"--kanban-side-shadow-opacity",
			String(overlap / width),
		);
		if (start < left - 1) {
			const depth = next ? Math.max(0, left + width - next.start) : 0;
			positionColumn(
				column,
				"left",
				depth / (depth + width),
				index + 1,
				columnHeight,
			);
		} else if (end > right + 1) {
			const depth = previous ? Math.max(0, previous.end - (right - width)) : 0;
			positionColumn(
				column,
				"right",
				depth / (depth + width),
				columns.length - index,
				columnHeight,
			);
		} else {
			positionColumn(column, "moving", 0, columns.length + 1, columnHeight);
		}
		previous = slot;
	});
}

export function useKanbanColumnStack(
	boardRef: RefObject<HTMLElement | null>,
	trackRef: RefObject<HTMLDivElement | null>,
	shownColumns: string[],
) {
	const { active, measureDroppableContainers } = useDndContext();

	useLayoutEffect(() => {
		const board = boardRef.current;
		const track = trackRef.current;
		if (!board || !track) return;
		const columns = Array.from(
			track.querySelectorAll<HTMLElement>(":scope > .kanban-column"),
		);
		const columnIds = shownColumns.map(columnId);
		board.style.setProperty("--kanban-stack-top", String(columns.length + 2));
		const stopObserving = observeStack(
			board,
			[board, track, ...columns],
			() => {
				updateColumnStack(board, track, columns);
				if (active) measureDroppableContainers(columnIds);
			},
		);
		const stopWheel = listenForBoardWheel(board);
		updateColumnStack(board, track, columns);
		return () => {
			stopObserving();
			stopWheel();
		};
	}, [boardRef, trackRef, shownColumns, active, measureDroppableContainers]);
}

export const stackedKanbanCollisionDetection: CollisionDetection = (args) => {
	// Column sorting animates the targets. Use dnd-kit's untransformed rects
	// so an animated column cannot take over the drop target mid-drag.
	if (!isCardId(args.active.id)) return kanbanCollisionDetection(args);
	const point = args.pointerCoordinates;
	const column =
		point &&
		document.elementFromPoint?.(point.x, point.y)?.closest(COLUMN_SELECTOR);
	const target =
		column &&
		args.droppableContainers.find(({ node }) => node.current === column);
	return target ? [{ id: target.id }] : kanbanCollisionDetection(args);
};
