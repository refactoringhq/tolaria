import { List } from "phosphor-react-native";
import { View } from "react-native";
import { MobileNoteListPanel } from "../components/workspace/MobileNoteListPanel";
import { mobileCopy } from "../i18n/mobileText";
import { probeProps } from "../qa/mobileLayoutProbe";
import { desktopToolbarActionParity } from "../ui/desktopParity";
import { MobileIconButton } from "../ui/MobileIconButton";
import type { MobileColors } from "../ui/theme/mobilePalette";
import { useMobileStyles } from "../ui/theme/useMobileTheme";
import { mobileWorkspaceHasNoVault } from "../workspace/mobileWorkspaceEmptyState";
import type {
	PhoneWorkspaceController,
	PhoneWorkspaceStateViewProps,
} from "./phoneWorkspaceScreenSupport";
import { createThemeStyles } from "./phoneWorkspaceStyles";

type PhoneNoteListScreenProps = PhoneWorkspaceStateViewProps & {
	mobileColors: MobileColors;
	styles: ReturnType<typeof createThemeStyles>["styles"];
};

export function PhoneNoteListScreen(props: PhoneWorkspaceStateViewProps) {
	const { styles, mobileColors } = useMobileStyles(createThemeStyles);
	return (
		<PhoneNoteListScreenContent
			{...props}
			mobileColors={mobileColors}
			styles={styles}
		/>
	);
}

function PhoneNoteListScreenContent(props: PhoneNoteListScreenProps) {
	return (
		<View
			{...probeProps(props.phoneLayoutProbe, "phone.list.screen")}
			style={props.styles.screen}
			testID="phone-note-list-screen"
		>
			<MobileNoteListPanel
				compact
				onToggleNoteFavorite={props.controller.onToggleNoteFavorite}
				bulkActions={phoneNoteListBulkActions(props.controller)}
				fullWidth
				phoneChrome
				{...phoneNoteListHeaderProps(props)}
				{...phoneNoteListFilterProps(props)}
				{...phoneNoteListBodyProps(props)}
			/>
		</View>
	);
}

function PhoneNoteListSidebarButton(props: {
	mobileColors: MobileColors;
	openSidebar: () => void;
}) {
	return (
		<MobileIconButton
			accessibilityLabel={mobileCopy.showSidebar}
			density="leading"
			testID="phone-note-list-sidebar-button"
			onPress={props.openSidebar}
		>
			<List
				color={props.mobileColors.textMuted}
				size={desktopToolbarActionParity.iconSize}
			/>
		</MobileIconButton>
	);
}

function phoneNoteListBulkActions(controller: PhoneWorkspaceController) {
	return {
		onArchive: controller.onBulkArchiveNotes,
		onDelete: controller.onBulkDeleteNotes,
		onOrganize: controller.onBulkOrganizeNotes,
	};
}

function phoneNoteListHeaderProps(props: PhoneNoteListScreenProps) {
	return {
		leading: <PhoneNoteListSidebarButton {...props} />,
		subtitle: props.controller.noteListSubtitle,
		title: props.controller.noteListTitle,
		onOpenSearch: props.controller.onOpenSearch,
	};
}

function phoneNoteListFilterProps(props: PhoneNoteListScreenProps) {
	return {
		noteListFilter: props.controller.noteListFilter,
		noteListFilterCounts: props.controller.noteListFilterCounts,
		noteListFilterVisible: props.controller.noteListFilterVisible,
		onNoteListFilterChange: props.controller.onNoteListFilterChange,
	};
}

function phoneNoteListBodyProps(props: PhoneNoteListScreenProps) {
	return {
		displayPropertyKeys: props.controller.noteListProperties,
		emptyVault: mobileWorkspaceHasNoVault(props.controller.snapshot),
		layoutProbe: props.options.layoutProbe,
		neighborhood: props.controller.noteListNeighborhood,
		notes: props.controller.notes,
		propertyDisplayModes:
			props.controller.snapshot.vaultConfig?.propertyDisplayModes,
		searchQuery: props.controller.searchQuery || undefined,
		selectedNoteId: props.controller.selectedNoteId,
		typeDefinitions: props.controller.snapshot.typeDefinitions,
		onOpenCreateNote: props.controller.onOpenCreateNote,
		onOpenVault: props.controller.onOpenCreateNote,
		onSelectNote: props.openEditor,
	};
}
