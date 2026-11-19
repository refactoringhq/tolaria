import type { Dispatch, KeyboardEvent, RefObject, SetStateAction } from "react";
import { useCallback, useEffect } from "react";

export type NoteListPropertiesScope = "type" | "inbox" | "all" | "view";

export interface OpenListPropertiesEventDetail {
	scope: NoteListPropertiesScope;
}

export const OPEN_NOTE_LIST_PROPERTIES_EVENT =
	"laputa:open-note-list-properties";

export function usePopoverOpenEvent(
	scope: NoteListPropertiesScope,
	setOpen: (open: boolean) => void,
): void {
	useEffect(() => {
		const handler = (event: Event) => {
			const detail = (event as CustomEvent<OpenListPropertiesEventDetail>)
				.detail;
			if (detail?.scope === scope) setOpen(true);
		};
		window.addEventListener(OPEN_NOTE_LIST_PROPERTIES_EVENT, handler);
		return () =>
			window.removeEventListener(OPEN_NOTE_LIST_PROPERTIES_EVENT, handler);
	}, [scope, setOpen]);
}

export function usePopoverSearchFocus(
	open: boolean,
	inputRef: RefObject<HTMLInputElement | null>,
): void {
	useEffect(() => {
		if (open) requestAnimationFrame(() => inputRef.current?.focus());
	}, [inputRef, open]);
}

export function usePopoverOpenChange(
	setOpen: Dispatch<SetStateAction<boolean>>,
	setQuery: Dispatch<SetStateAction<string>>,
) {
	return useCallback(
		(nextOpen: boolean) => {
			setOpen(nextOpen);
			if (!nextOpen) setQuery("");
		},
		[setOpen, setQuery],
	);
}

export function usePopoverEscapeHandlers(closePopover: () => void) {
	const handleSearchKeyDown = useCallback(
		(event: KeyboardEvent<HTMLInputElement>) => {
			if (event.key !== "Escape") return;
			event.preventDefault();
			closePopover();
		},
		[closePopover],
	);
	const handlePanelKeyDown = useCallback(
		(event: KeyboardEvent<HTMLDivElement>) => {
			if (event.key !== "Escape") return;
			event.preventDefault();
			closePopover();
		},
		[closePopover],
	);
	return { handleSearchKeyDown, handlePanelKeyDown };
}

export function openNoteListPropertiesPicker(
	scope: NoteListPropertiesScope,
): void {
	window.dispatchEvent(
		new CustomEvent<OpenListPropertiesEventDetail>(
			OPEN_NOTE_LIST_PROPERTIES_EVENT,
			{
				detail: { scope },
			},
		),
	);
}
