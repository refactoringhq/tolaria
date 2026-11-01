import { type ReactNode, useCallback, useState } from "react";
import { useMobileLayoutProbe } from "../../qa/mobileLayoutProbe";
import { shouldShowPhoneNoteListTitle } from "../../screens/phoneNoteListChrome";
import type { MobileNeighborhood } from "../../workspace/mobileNeighborhood";
import type { MobileNoteListFilter } from "../../workspace/mobileNoteFilters";
import type {
	MobileNote,
	MobilePropertyDisplayMode,
	MobileTypeDefinitions,
} from "../../workspace/mobileWorkspaceModel";
import { useMobilePullToSync } from "../../workspace/useMobilePullToSync";
import { MobileNoteListPanelView } from "./MobileNoteListPanelView";
import {
	type MobileNoteListBulkActions,
	useMobileNoteListBulkSelection,
} from "./useMobileNoteListSelection";

export type MobileNoteListPanelProps = {
	bulkActions?: MobileNoteListBulkActions;
	compact: boolean;
	displayPropertyKeys?: string[];
	emptyVault?: boolean;
	fullWidth?: boolean;
	leading?: ReactNode;
	toolbarTrailing?: ReactNode;
	showCreateAction?: boolean;
	layoutProbe?: boolean;
	phoneChrome?: boolean;
	neighborhood?: MobileNeighborhood | null;
	noteListFilter?: MobileNoteListFilter;
	noteListFilterCounts?: Record<MobileNoteListFilter, number>;
	noteListFilterVisible?: boolean;
	notes: MobileNote[];
	onOpenCreateNote: () => void;
	onOpenSearch: () => void;
	onOpenVault?: () => void;
	onNoteListFilterChange?: (filter: MobileNoteListFilter) => void;
	onSelectNote: (noteId: string) => void;
	onToggleNoteFavorite?: (noteId: string) => void;
	propertyDisplayModes?: Record<string, MobilePropertyDisplayMode> | null;
	searchQuery?: string;
	selectedNoteId: string | null;
	subtitle: string;
	title?: string;
	typeDefinitions?: MobileTypeDefinitions;
};

export const MobileNoteListPanel = (props: MobileNoteListPanelProps) => {
	const refreshControl = useMobilePullToSync();
	const onFilterChange = noteListFilterAction(props);
	const activeNoteId = props.selectedNoteId ?? props.notes[0]?.id ?? null;
	const layoutProbe = useMobileLayoutProbe(props.layoutProbe ?? false);
	const [compactTitleVisible, setCompactTitleVisible] = useState(false);
	const onListScroll = useCallback((offset: number) => {
		const visible = shouldShowPhoneNoteListTitle(offset);
		setCompactTitleVisible((current) =>
			current === visible ? current : visible,
		);
	}, []);
	const bulkSelection = useMobileNoteListBulkSelection({
		bulkActions: props.bulkActions,
		neighborhood: props.neighborhood ?? null,
		notes: props.notes,
		onSelectNote: props.onSelectNote,
	});
	return (
		<MobileNoteListPanelView
			{...props}
			activeNoteId={activeNoteId}
			bulkSelection={bulkSelection}
			compactTitleVisible={compactTitleVisible}
			layoutProbeState={layoutProbe}
			onFilterChange={onFilterChange}
			onListScroll={onListScroll}
			refreshControl={refreshControl}
		/>
	);
};

function noteListFilterAction({
	noteListFilterVisible,
	onNoteListFilterChange,
}: MobileNoteListPanelProps) {
	return noteListFilterVisible ? onNoteListFilterChange : undefined;
}
