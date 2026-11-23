import type {
	DragEndEvent,
	DragOverEvent,
	DragStartEvent,
	UniqueIdentifier,
} from "@dnd-kit/core";
import { type SetStateAction, useCallback, useEffect, useState } from "react";
import type { VaultEntry } from "../../../types";
import type { DayKey } from "./calendarDates";
import {
	type CalendarDates,
	type CalendarItem,
	type CalendarSources,
	movedDates,
	type PendingDates,
	settlePendingDates,
	withoutPendingDates,
} from "./calendarModel";

const DAY_DROP_PREFIX = "calendar-day:";
const DROP_HIGHLIGHT_MS = 420;
/** A drop that the vault never confirms (for example a failed write) snaps back after this delay. */
const PENDING_DROP_TIMEOUT_MS = 5000;

type SetPendingDates = (update: SetStateAction<PendingDates>) => void;

export interface CalendarDrop {
	item: CalendarItem;
	next: CalendarDates;
	/** True when the note came from the unscheduled tray. */
	fromTray: boolean;
}

/** The note being dragged; `anchor` is the day it was picked up on, so a range keeps its offset. */
export interface CalendarActiveDrag {
	item: CalendarItem;
	fromTray: boolean;
	anchor: DayKey | null;
}

export function dayDropId(day: DayKey): string {
	return `${DAY_DROP_PREFIX}${day}`;
}

export function dayFromDropId(
	id: UniqueIdentifier | undefined,
): DayKey | undefined {
	if (typeof id !== "string" || !id.startsWith(DAY_DROP_PREFIX))
		return undefined;
	return id.slice(DAY_DROP_PREFIX.length);
}

function sameSources(left: CalendarSources, right: CalendarSources): boolean {
	return (
		left.dateProperty === right.dateProperty &&
		left.endDateProperty === right.endDateProperty
	);
}

/** Optimistic dates for dropped items until the vault entry reports the written values. */
export function usePendingDates(
	entries: VaultEntry[],
	sources: CalendarSources,
) {
	const [state, setState] = useState(() => ({
		entries,
		sources,
		pending: new Map() as PendingDates,
	}));
	let current = state;
	if (state.entries !== entries || !sameSources(state.sources, sources)) {
		current = {
			entries,
			sources,
			pending: settlePendingDates(state.pending, entries, sources),
		};
		setState(current);
	}
	const setPending = useCallback<SetPendingDates>((update) => {
		setState((previous) => ({
			...previous,
			pending: typeof update === "function" ? update(previous.pending) : update,
		}));
	}, []);
	return [current.pending, setPending] as const;
}

function useDroppedHighlight() {
	const [droppedPath, setDroppedPath] = useState<string | null>(null);
	useEffect(() => {
		if (!droppedPath) return;
		const timer = window.setTimeout(
			() => setDroppedPath(null),
			DROP_HIGHLIGHT_MS,
		);
		return () => window.clearTimeout(timer);
	}, [droppedPath]);
	return [droppedPath, setDroppedPath] as const;
}

function activeFor(event: DragStartEvent): CalendarActiveDrag | null {
	const data = event.active.data.current as
		| {
				item?: CalendarItem;
				fromTray?: boolean;
				anchor?: DayKey;
		  }
		| undefined;
	if (!data?.item) return null;
	return {
		item: data.item,
		fromTray: Boolean(data.fromTray),
		anchor: data.anchor ?? null,
	};
}

/** Where the dragged note would land if dropped on `target`. */
export function dropDates(
	active: CalendarActiveDrag,
	target: DayKey,
): CalendarDates {
	if (active.fromTray) return { start: target, end: target };
	return movedDates(active.item, active.anchor ?? active.item.start, target);
}

interface CalendarDragOptions {
	setPending: SetPendingDates;
	onDrop: (drop: CalendarDrop) => void;
}

/** Shows a drop on its new day straight away, and snaps it back if the vault never confirms the write. */
function useCommitDrop({ setPending, onDrop }: CalendarDragOptions) {
	const [droppedPath, setDroppedPath] = useDroppedHighlight();
	const commit = useCallback(
		(active: CalendarActiveDrag, target: DayKey) => {
			const next = dropDates(active, target);
			if (!active.fromTray && next.start === active.item.start) return;
			const path = active.item.entry.path;
			setPending((current) => new Map(current).set(path, next));
			window.setTimeout(
				() => setPending((current) => withoutPendingDates(current, path, next)),
				PENDING_DROP_TIMEOUT_MS,
			);
			setDroppedPath(path);
			onDrop({ item: active.item, next, fromTray: active.fromTray });
		},
		[onDrop, setDroppedPath, setPending],
	);
	return { droppedPath, commit };
}

/** The first day a drag passes over is the day it was picked up on. */
function anchoredOn(
	current: CalendarActiveDrag | null,
	day: DayKey | undefined,
): CalendarActiveDrag | null {
	if (!current) return current;
	if (current.anchor) return current;
	if (!day) return current;
	return { ...current, anchor: day };
}

export function useCalendarDrag(options: CalendarDragOptions) {
	const [active, setActive] = useState<CalendarActiveDrag | null>(null);
	const [overDay, setOverDay] = useState<DayKey | undefined>(undefined);
	const { droppedPath, commit } = useCommitDrop(options);
	const reset = useCallback(() => {
		setActive(null);
		setOverDay(undefined);
	}, []);
	const onDragStart = useCallback(
		(event: DragStartEvent) => setActive(activeFor(event)),
		[],
	);
	const onDragOver = useCallback((event: DragOverEvent) => {
		const day = dayFromDropId(event.over?.id);
		setOverDay(day);
		setActive((current) => anchoredOn(current, day));
	}, []);
	const onDragEnd = useCallback(
		(event: DragEndEvent) => {
			const target = dayFromDropId(event.over?.id);
			reset();
			if (active && target) commit(active, target);
		},
		[active, commit, reset],
	);
	const preview = active && overDay ? dropDates(active, overDay) : null;
	return {
		active,
		preview,
		droppedPath,
		onDragStart,
		onDragOver,
		onDragEnd,
		onDragCancel: reset,
	};
}
