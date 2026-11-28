const RETRACTION_DISTANCE = 32;
const FIRST_ROW_RETRACTION_DISTANCE = 8;
const PROGRESS_PROPERTY = "--note-bookmark-progress";

function firstRowProgress(scrollTop: number) {
	const distance = Math.min(
		1,
		Math.max(0, scrollTop / FIRST_ROW_RETRACTION_DISTANCE),
	);
	// Move along a quarter-circle so the overhang recedes quickly just below the header.
	return 1 - Math.sqrt(distance * (2 - distance));
}

function bookmarkProgress(
	row: HTMLElement,
	scroller: HTMLElement,
	list: HTMLElement,
) {
	if (row.closest('[data-item-index="0"]'))
		return firstRowProgress(scroller.scrollTop);
	const distance =
		row.getBoundingClientRect().top - list.getBoundingClientRect().top;
	return Math.min(1, Math.max(0, distance / RETRACTION_DISTANCE));
}

function trackBookmark(marker: HTMLSpanElement | null) {
	const row = marker?.closest<HTMLElement>("[data-note-path]");
	if (!row) return;
	const scroller = row.closest<HTMLElement>("[data-virtuoso-scroller]");
	if (!scroller) return;
	const list = scroller.closest<HTMLElement>(
		'[data-testid="note-list-container"]',
	);
	if (!list) return;

	let previousProgress = -1;
	const update = () => {
		const progress = bookmarkProgress(row, scroller, list);
		if (progress === previousProgress) return;
		previousProgress = progress;
		row.style.setProperty(PROGRESS_PROPERTY, String(progress));
	};

	const observer = new ResizeObserver(update);
	observer.observe(row);
	observer.observe(list);
	scroller.addEventListener("scroll", update, { passive: true });
	update();

	return () => {
		observer.disconnect();
		scroller.removeEventListener("scroll", update);
		row.style.removeProperty(PROGRESS_PROPERTY);
	};
}

export function NoteBookmarkRetraction() {
	return <span hidden ref={trackBookmark} />;
}
