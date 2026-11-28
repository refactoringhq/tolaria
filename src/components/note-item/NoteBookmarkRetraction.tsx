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

const seamOwners = new WeakMap<HTMLElement, symbol>();

function visibleSeam(row: HTMLElement, scroller: HTMLElement, editor: HTMLElement) {
	const note = row.getBoundingClientRect();
	const viewport = scroller.getBoundingClientRect();
	const frame = editor.getBoundingClientRect();
	const start = Math.min(frame.height, Math.max(0, Math.max(note.top, viewport.top) - frame.top));
	const end = Math.max(start, Math.min(frame.height, Math.min(note.bottom, viewport.bottom) - frame.top));
	return { start, end };
}

function trackEditorSeam(row: HTMLElement, scroller: HTMLElement) {
	const app = row.closest<HTMLElement>(".app[data-desktop-sidebar-chrome]");
	const editor = app?.querySelector<HTMLElement>(":scope > .app__editor");
	if (!editor) return null;

	const owner = Symbol();
	seamOwners.set(editor, owner);
	return {
		editor,
		update() {
			if (seamOwners.get(editor) !== owner) return;
			const { start, end } = visibleSeam(row, scroller, editor);
			editor.style.setProperty("--active-note-seam-start", `${start}px`);
			editor.style.setProperty("--active-note-seam-end", `${end}px`);
		},
		dispose() {
			if (seamOwners.get(editor) !== owner) return;
			seamOwners.delete(editor);
			editor.style.removeProperty("--active-note-seam-start");
			editor.style.removeProperty("--active-note-seam-end");
		},
	};
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

	const seam = trackEditorSeam(row, scroller);
	let previousProgress = -1;
	const update = () => {
		seam?.update();
		const progress = bookmarkProgress(row, scroller, list);
		if (progress === previousProgress) return;
		previousProgress = progress;
		row.style.setProperty(PROGRESS_PROPERTY, String(progress));
	};

	const observer = new ResizeObserver(update);
	observer.observe(row);
	observer.observe(list);
	if (seam) observer.observe(seam.editor);
	scroller.addEventListener("scroll", update, { passive: true });
	update();

	return () => {
		observer.disconnect();
		seam?.dispose();
		scroller.removeEventListener("scroll", update);
		row.style.removeProperty(PROGRESS_PROPERTY);
	};
}

export function NoteBookmarkRetraction() {
	return <span hidden ref={trackBookmark} />;
}
