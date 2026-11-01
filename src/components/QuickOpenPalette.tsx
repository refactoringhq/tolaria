import type { RefObject } from "react";
import {
	useCallback,
	useEffect,
	useEffectEvent,
	useRef,
	useState,
} from "react";
import type { NoteSearchResult } from "../hooks/useNoteSearch";
import { useNoteSearch } from "../hooks/useNoteSearch";
import type { AppLocale } from "../lib/i18n";
import type { VaultEntry } from "../types";
import {
	QuickOpenPaletteDialog,
	QuickOpenPalettePanel,
} from "./QuickOpenPalettePanel";

interface QuickOpenPaletteProps {
	open: boolean;
	entries: VaultEntry[];
	isLoading?: boolean;
	onSelect: (entry: VaultEntry) => void;
	onCreateNote?: (title: string) => unknown | Promise<unknown>;
	onClose: () => void;
	locale?: AppLocale;
}

function selectAndClose(
	entry: VaultEntry,
	onSelect: (entry: VaultEntry) => void,
	onClose: () => void,
) {
	onSelect(entry);
	onClose();
}

function useQuickOpenInputFocus(inputRef: RefObject<HTMLInputElement | null>) {
	useEffect(() => {
		const focusTimer = setTimeout(() => inputRef.current?.focus(), 50);
		return () => clearTimeout(focusTimer);
	}, [inputRef]);
}

function useQuickOpenBackdrop(
	rootRef: RefObject<HTMLDivElement | null>,
	onClose: () => void,
) {
	useEffect(() => {
		const root = rootRef.current;
		return root ? closeOnBackdrop(root, onClose) : undefined;
	}, [rootRef, onClose]);
}

function useQuickOpenSurface(
	inputRef: RefObject<HTMLInputElement | null>,
	rootRef: RefObject<HTMLDivElement | null>,
	onClose: () => void,
) {
	useQuickOpenInputFocus(inputRef);
	useQuickOpenBackdrop(rootRef, onClose);
}

function useQuickOpenCreateAction({
	query,
	isLoading,
	resultCount,
	onCreateNote,
	onClose,
}: {
	query: string;
	isLoading: boolean;
	resultCount: number;
	onCreateNote?: (title: string) => unknown;
	onClose: () => void;
}) {
	const [isCreating, setIsCreating] = useState(false);
	const title = query.trim();
	const canCreate = Boolean(
		onCreateNote && title && !isLoading && resultCount === 0,
	);
	const create = useCallback(async () => {
		if (!canCreate || isCreating) return;
		setIsCreating(true);
		try {
			const result = await onCreateNote?.(title);
			if (result !== false) onClose();
		} finally {
			setIsCreating(false);
		}
	}, [canCreate, isCreating, title, onCreateNote, onClose]);

	return { canCreate, create, title, isCreating };
}

function useQuickOpenKeyboard({
	results,
	selectedIndex,
	onSelect,
	onClose,
	handleKeyDown,
	createFromQuery,
}: {
	results: NoteSearchResult[];
	selectedIndex: number;
	onSelect: (entry: VaultEntry) => void;
	onClose: () => void;
	handleKeyDown: (e: KeyboardEvent) => void;
	createFromQuery: () => void | Promise<void>;
}) {
	const onKeyDown = useEffectEvent((e: KeyboardEvent) => {
		handleKeyDown(e);
		if (e.key === "Escape") {
			e.preventDefault();
			onClose();
		} else if (e.key === "Enter") {
			e.preventDefault();
			const selected = results.at(selectedIndex);
			if (selected) {
				selectAndClose(selected.entry, onSelect, onClose);
			} else {
				void createFromQuery();
			}
		}
	});
	useEffect(() => {
		const handler = (e: KeyboardEvent) => onKeyDown(e);
		window.addEventListener("keydown", handler);
		return () => window.removeEventListener("keydown", handler);
	}, []);
}

function closeOnBackdrop(
	root: HTMLDivElement,
	onClose: () => void,
): () => void {
	const handleRootClick = (event: MouseEvent) => {
		if (event.target === root) onClose();
	};
	root.addEventListener("click", handleRootClick);
	return () => root.removeEventListener("click", handleRootClick);
}

export function QuickOpenPalette(props: QuickOpenPaletteProps) {
	if (!props.open) return null;

	return <QuickOpenPaletteContent {...props} />;
}

function QuickOpenPaletteContent({
	entries,
	isLoading = false,
	onSelect,
	onCreateNote,
	onClose,
	locale = "en",
}: QuickOpenPaletteProps) {
	const [query, setQuery] = useState("");
	const inputRef = useRef<HTMLInputElement>(null);
	const rootRef = useRef<HTMLDivElement>(null);
	const { results, selectedIndex, setSelectedIndex, handleKeyDown } =
		useNoteSearch(entries, query);
	const createAction = useQuickOpenCreateAction({
		query,
		isLoading,
		resultCount: results.length,
		onCreateNote,
		onClose,
	});

	useQuickOpenSurface(inputRef, rootRef, onClose);

	useQuickOpenKeyboard({
		results,
		selectedIndex,
		onSelect,
		onClose,
		handleKeyDown,
		createFromQuery: createAction.create,
	});

	return (
		<QuickOpenPaletteDialog rootRef={rootRef} onClose={onClose}>
			<QuickOpenPalettePanel
				inputRef={inputRef}
				query={query}
				locale={locale}
				results={results}
				selectedIndex={selectedIndex}
				isLoading={isLoading}
				onQueryChange={setQuery}
				onSelect={(entry) => selectAndClose(entry, onSelect, onClose)}
				onSelectedIndexChange={setSelectedIndex}
				createAction={{
					canCreate: createAction.canCreate,
					title: createAction.title,
					onCreate: createAction.create,
					disabled: createAction.isCreating,
				}}
			/>
		</QuickOpenPaletteDialog>
	);
}
