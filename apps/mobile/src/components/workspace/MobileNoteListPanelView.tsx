import { MagnifyingGlass } from "phosphor-react-native";
import type { ReactElement } from "react";
import { type RefreshControlProps, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { mobileCopy } from "../../i18n/mobileText";
import { MobileLayoutProbeReadout } from "../../qa/MobileLayoutProbeReadout";
import type { useMobileLayoutProbe } from "../../qa/mobileLayoutProbe";
import { PhoneNoteListCreateAction } from "../../screens/PhoneNoteListCreateAction";
import { PhoneNoteListFilter } from "../../screens/PhoneNoteListFilter";
import { PhoneNoteListGlassChrome } from "../../screens/PhoneNoteListGlassChrome";
import {
	desktopPanelParity,
	desktopToolbarActionParity,
} from "../../ui/desktopParity";
import { MobileIconButton } from "../../ui/MobileIconButton";
import {
	MobilePanel,
	MobileToolbar,
	MobileToolbarSpacer,
	MobileToolbarTitle,
} from "../../ui/MobilePanel";
import { useMobileStyles } from "../../ui/theme/useMobileTheme";
import type { MobileNoteListFilter } from "../../workspace/mobileNoteFilters";
import { MobileCreateNoteButton } from "./MobileCreateNoteButton";
import { SearchPill } from "./MobileNoteListItems";
import type { MobileNoteListPanelProps } from "./MobileNoteListPanel";
import { createThemeStyles } from "./MobileNoteListPanel.styles";
import { mobileNoteListToolbarChrome } from "./MobileNoteListPanelChrome";
import {
	MobileNoteListPanelBulkSelectionBar,
	MobileNoteListPanelContent,
	MobileNoteListPanelFilterPills,
} from "./MobileNoteListPanelParts";
import { mobileNoteListRowActions } from "./mobileNoteListRows";
import type { useMobileNoteListBulkSelection } from "./useMobileNoteListSelection";

type ViewProps = MobileNoteListPanelProps & {
	activeNoteId: string | null;
	bulkSelection: ReturnType<typeof useMobileNoteListBulkSelection>;
	compactTitleVisible: boolean;
	layoutProbeState: ReturnType<typeof useMobileLayoutProbe>;
	onFilterChange?: (filter: MobileNoteListFilter) => void;
	onListScroll: (offset: number) => void;
	refreshControl?: ReactElement<RefreshControlProps>;
};

export function MobileNoteListPanelView(props: ViewProps) {
	const { styles, mobileColors } = useMobileStyles(createThemeStyles);
	const { bottom } = useSafeAreaInsets();
	const title = props.title ?? mobileCopy.inbox;
	return (
		<MobilePanel
			{...props.layoutProbeState.probe("noteList.panel")}
			style={[
				panelStyles.panel,
				props.compact ? panelStyles.panelCompact : null,
				props.fullWidth ? panelStyles.panelFullWidth : null,
				{ paddingBottom: props.onFilterChange ? 0 : bottom },
			]}
			testID="note-list-panel"
		>
			<Toolbar
				props={props}
				styles={styles}
				mobileColors={mobileColors}
				title={title}
			/>
			{props.searchQuery ? (
				<SearchPill searchQuery={props.searchQuery} />
			) : null}
			<PanelBody props={props} styles={styles} title={title} />
			<MobileNoteListPanelBulkSelectionBar
				bulkActions={props.bulkActions}
				bulkSelection={props.bulkSelection}
			/>
			<PanelFooter props={props} title={title} />
			{props.layoutProbe ? (
				<MobileLayoutProbeReadout
					metrics={props.layoutProbeState.metrics}
					testID="note-list-layout-metrics"
				/>
			) : null}
		</MobilePanel>
	);
}

function Toolbar(props: {
	props: ViewProps;
	styles: ReturnType<typeof createThemeStyles>["styles"];
	mobileColors: import("../../ui/theme/mobilePalette").MobileColors;
	title: string;
}) {
	if (props.props.phoneChrome) return null;
	return (
		<MobileToolbar testID="note-list-toolbar">
			{props.props.leading}
			<View style={props.styles.toolbarTitleBlock}>
				<MobileToolbarTitle
					testID="note-list-toolbar-title"
					title={props.title}
				/>
			</View>
			<MobileToolbarSpacer />
			{props.props.toolbarTrailing ?? (
				<MobileIconButton
					accessibilityLabel={mobileCopy.searchNotes}
					testID={mobileNoteListToolbarChrome.actionTestIds[0]}
					onPress={props.props.onOpenSearch}
				>
					<MagnifyingGlass
						color={props.mobileColors.textMuted}
						size={desktopToolbarActionParity.iconSize}
					/>
				</MobileIconButton>
			)}
		</MobileToolbar>
	);
}

function PanelBody(props: {
	props: ViewProps;
	styles: ReturnType<typeof createThemeStyles>["styles"];
	title: string;
}) {
	const visible =
		(props.props.showCreateAction ?? true) &&
		props.props.bulkSelection.selectedNotes.length === 0;
	return (
		<View style={props.styles.listBody}>
			<MobileNoteListPanelContent
				rowActions={mobileNoteListRowActions(
					props.props.bulkActions,
					props.props.onToggleNoteFavorite,
				)}
				activeNoteId={props.props.activeNoteId}
				bulkSelection={props.props.bulkSelection}
				displayPropertyKeys={props.props.displayPropertyKeys ?? []}
				emptyVault={props.props.emptyVault ?? false}
				layoutProbe={props.props.layoutProbeState.probe}
				neighborhood={props.props.neighborhood ?? null}
				notes={props.props.notes}
				onOpenVault={props.props.onOpenVault}
				onSelectNote={props.props.onSelectNote}
				propertyDisplayModes={props.props.propertyDisplayModes}
				searchQuery={props.props.searchQuery}
				refreshControl={props.props.refreshControl}
				selectedNoteId={props.props.selectedNoteId}
				phoneTitle={props.props.phoneChrome ? props.title : undefined}
				onScrollOffset={
					props.props.phoneChrome ? props.props.onListScroll : undefined
				}
				typeDefinitions={props.props.typeDefinitions}
			/>
			{props.props.phoneChrome ? (
				<PhoneNoteListCreateAction
					visible={visible}
					onPress={props.props.onOpenCreateNote}
				/>
			) : (
				<MobileCreateNoteButton
					visible={visible}
					onPress={props.props.onOpenCreateNote}
				/>
			)}
		</View>
	);
}

function PanelFooter(props: { props: ViewProps; title: string }) {
	return (
		<>
			<PanelFooterFilter props={props.props} />
			{props.props.phoneChrome ? (
				<PhoneNoteListGlassChrome
					leading={props.props.leading}
					onOpenSearch={props.props.onOpenSearch}
					title={props.title}
					titleVisible={props.props.compactTitleVisible}
				/>
			) : null}
		</>
	);
}

function PanelFooterFilter(props: { props: ViewProps }) {
	if (!props.props.onFilterChange) return null;
	const filterProps = {
		active: props.props.noteListFilter ?? "open",
		counts: props.props.noteListFilterCounts ?? { archived: 0, open: 0 },
		onChange: props.props.onFilterChange,
	};
	return props.props.phoneChrome ? (
		<PhoneNoteListFilter {...filterProps} />
	) : (
		<MobileNoteListPanelFilterPills {...filterProps} />
	);
}

const panelStyles = StyleSheet.create({
	panel: {
		alignSelf: "stretch",
		borderRightWidth: StyleSheet.hairlineWidth,
		height: "100%",
		width: desktopPanelParity.noteListWidth,
	},
	panelCompact: { width: 336 },
	panelFullWidth: { width: "100%" },
});
