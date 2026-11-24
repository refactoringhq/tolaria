import {
	type MouseEvent,
	type PointerEvent as ReactPointerEvent,
	useEffect,
	useRef,
} from "react";

const DRAG_DISTANCE_PX = 6;
const FORBIDDEN_CURSOR_CLASS = "calendar-drag-forbidden";
const NO_CLEANUP = () => {};

function isDragPointer(event: ReactPointerEvent): boolean {
	if (event.pointerType === "touch") return false;
	if (!event.isPrimary) return false;
	if (event.button !== 0) return false;
	if (!(event.target instanceof Element)) return false;
	return event.target.closest('[data-testid="calendar-item"]') !== null;
}

/** Read-only dates remain clickable; only a movement with the button held is rejected as a drag. */
export function useBlockedCalendarDrag(readOnly: boolean) {
	const cleanup = useRef(NO_CLEANUP);
	const suppressClick = useRef(false);
	useEffect(() => () => cleanup.current(), [readOnly]);

	const onPointerDownCapture = (event: ReactPointerEvent) => {
		cleanup.current();
		suppressClick.current = false;
		if (!readOnly) return;
		if (!isDragPointer(event)) return;
		const { clientX, clientY, pointerId } = event;
		const finish = () => {
			cleanup.current();
			cleanup.current = NO_CLEANUP;
		};
		const move = (next: PointerEvent) => {
			if (next.pointerId !== pointerId) return;
			if (
				Math.hypot(next.clientX - clientX, next.clientY - clientY) <
				DRAG_DISTANCE_PX
			)
				return;
			suppressClick.current = true;
			document.body.classList.add(FORBIDDEN_CURSOR_CLASS);
			next.preventDefault();
		};
		const end = (next: PointerEvent) => {
			if (next.pointerId === pointerId) finish();
		};
		const key = (next: KeyboardEvent) => {
			if (next.key === "Escape") finish();
		};
		document.addEventListener("pointermove", move, true);
		document.addEventListener("pointerup", end, true);
		document.addEventListener("pointercancel", end, true);
		document.addEventListener("keydown", key, true);
		window.addEventListener("blur", finish);
		cleanup.current = () => {
			document.removeEventListener("pointermove", move, true);
			document.removeEventListener("pointerup", end, true);
			document.removeEventListener("pointercancel", end, true);
			document.removeEventListener("keydown", key, true);
			window.removeEventListener("blur", finish);
			document.body.classList.remove(FORBIDDEN_CURSOR_CLASS);
		};
	};
	const onClickCapture = (event: MouseEvent) => {
		if (event.detail === 0) return;
		if (!suppressClick.current) return;
		suppressClick.current = false;
		event.preventDefault();
		event.stopPropagation();
	};
	return { onPointerDownCapture, onClickCapture };
}
