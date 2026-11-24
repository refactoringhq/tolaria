import { memo, useCallback, useEffect } from "react";
import { useNoteListPaintedMark } from "../hooks/useNoteListPaintedMark";
import { usePhoneNoteOpener } from "../hooks/phoneNoteStackStore";
import type { NoteListMultiSelectionCommands } from "./note-list/multiSelectionCommands";
import { NoteListLayout } from "./note-list/NoteListLayout";
import { useMultiSelectKeyboard } from "./note-list/useMultiSelectKeyboard";
import { useNoteListDeletionFocus } from "./note-list/useNoteListDeletionFocus";
import {
	type NoteListProps,
	useNoteListModel,
} from "./note-list/useNoteListModel";

type NoteListInnerProps = NoteListProps & {
	onBulkOrganize?: (paths: string[]) => void;
	multiSelectionCommandRef?: React.MutableRefObject<NoteListMultiSelectionCommands | null>;
};

function NoteListInner({
	onBulkOrganize,
	multiSelectionCommandRef,
	...props
}: NoteListInnerProps) {
	// On the phone a tapped note takes the screen, the open one included (TOL-193).
	const onReplaceActiveTab = usePhoneNoteOpener(props.onReplaceActiveTab);
	const model = useNoteListModel({ ...props, onReplaceActiveTab });
	useNoteListPaintedMark(model.visibleEntries.length > 0);
	useNoteListDeletionFocus({
		entries: props.entries,
		visible: model.visibleEntries,
		selection: props.selection,
		loading: props.loading ?? false,
		openNote: props.onReplaceActiveTab,
		focusList: model.focusNoteList,
	});

	const handleBulkOrganize = useCallback(() => {
		const paths = [...model.multiSelect.selectedPaths];
		model.multiSelect.clear();
		onBulkOrganize?.(paths);
	}, [model.multiSelect, onBulkOrganize]);

	useMultiSelectKeyboard({
		multiSelect: model.multiSelect,
		isEntityView: model.isEntityView,
		onBulkOrganize: onBulkOrganize ? handleBulkOrganize : undefined,
		onBulkDelete: props.onBulkDeletePermanently
			? model.handleBulkDeletePermanently
			: undefined,
		enableActionShortcuts: !multiSelectionCommandRef,
	});

	useEffect(() => {
		if (!multiSelectionCommandRef) return;

		multiSelectionCommandRef.current = {
			selectedPaths: [...model.multiSelect.selectedPaths],
			deleteSelected: props.onBulkDeletePermanently
				? model.handleBulkDeletePermanently
				: undefined,
			organizeSelected: onBulkOrganize ? handleBulkOrganize : undefined,
		};

		return () => {
			multiSelectionCommandRef.current = null;
		};
	}, [
		handleBulkOrganize,
		model.handleBulkDeletePermanently,
		model.multiSelect.selectedPaths,
		multiSelectionCommandRef,
		onBulkOrganize,
		props.onBulkDeletePermanently,
	]);

	return (
		<NoteListLayout
			{...model}
			handleBulkOrganize={onBulkOrganize ? handleBulkOrganize : undefined}
		/>
	);
}

export const NoteList = memo(NoteListInner);
