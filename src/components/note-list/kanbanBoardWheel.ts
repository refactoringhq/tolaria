function horizontalWheelDelta(event: WheelEvent, width: number) {
	const { deltaX, deltaY, deltaMode, shiftKey } = event;
	const unit = deltaMode === 2 ? width : deltaMode === 1 ? 16 : 1;
	if (Math.abs(deltaX) > Math.abs(deltaY)) return deltaX * unit;
	return shiftKey ? (deltaX || deltaY) * unit : 0;
}

function handleBoardWheel(event: WheelEvent, board: HTMLElement) {
	if (event.ctrlKey || event.defaultPrevented) return;
	if (!event.cancelable) return;
	const delta = horizontalWheelDelta(event, board.clientWidth);
	if (!delta) return;
	// Route horizontal gestures around the independent vertical scrollers in each column.
	event.preventDefault();
	board.scrollLeft += delta;
}

export function listenForBoardWheel(board: HTMLElement) {
	const surface = board.parentElement;
	const wheel = (event: WheelEvent) => {
		if (event.clientY >= board.getBoundingClientRect().top)
			handleBoardWheel(event, board);
	};
	surface?.addEventListener("wheel", wheel, { passive: false });
	return () => surface?.removeEventListener("wheel", wheel);
}
