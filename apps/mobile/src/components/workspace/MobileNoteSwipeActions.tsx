import { ArchiveIcon, CheckCircle, Star, Trash } from "phosphor-react-native";
import { StyleSheet, View, type ViewStyle } from "react-native";
import Animated, {
	type SharedValue,
	useAnimatedStyle,
} from "react-native-reanimated";
import { mobileText } from "../../i18n/mobileText";
import type { MobileColors } from "../../ui/theme/mobilePalette";
import { useMobileStyles } from "../../ui/theme/useMobileTheme";

import { Button } from "../ui/button";
import {
	fullSwipeNoteAction,
	mobileNoteSwipeActionOrder,
} from "./mobileNoteSwipe";

type ActionProps = {
	archived?: boolean;
	favorite: boolean;
	noteId: string;
	onArchive: () => void;
	onDelete: () => void;
	onFavorite: () => void;
	onOrganize: () => void;
	primarySwipeAction?: "archive" | "organize";
	translation: SharedValue<number>;
	width: SharedValue<number>;
};

export function MobileNoteSwipeActions(props: ActionProps) {
	const { styles, mobileColors } = useMobileStyles(createThemeStyles);
	const actionOrder = mobileNoteSwipeActionOrder(
		props.primarySwipeAction ?? "archive",
	);
	const organizeIsPrimary = actionOrder.at(-1) === "organize";
	const baseWidth = actionOrder.length * 72;
	const expansion = useAnimatedStyle<ViewStyle>(() => ({
		width: Math.max(baseWidth, Math.abs(props.translation.value)),
	}));
	const secondaryStyle = useAnimatedStyle<ViewStyle>(() => ({
		width: fullSwipeNoteAction(
			props.translation.value,
			props.width.value,
			props.primarySwipeAction,
		)
			? 0
			: 72,
		overflow: "hidden",
	}));
	return (
		<View style={{ width: baseWidth }}>
			<Animated.View style={[styles.actions, expansion]}>
				<SwipeSecondaryActions
					props={props}
					styles={styles}
					mobileColors={mobileColors}
					style={secondaryStyle}
				/>
				<SwipePrimaryAction
					props={props}
					styles={styles}
					mobileColors={mobileColors}
					organizeIsPrimary={organizeIsPrimary}
				/>
			</Animated.View>
		</View>
	);
}

function SwipeSecondaryActions({
	props,
	styles,
	mobileColors,
	style,
}: {
	props: ActionProps;
	styles: ReturnType<typeof createThemeStyles>["styles"];
	mobileColors: MobileColors;
	style: ReturnType<typeof useAnimatedStyle<ViewStyle>>;
}) {
	return (
		<>
			<Animated.View style={style}>
				<Button
					accessibilityLabel={mobileText(
						props.favorite
							? "editor.toolbar.removeFavorite"
							: "editor.toolbar.addFavorite",
					)}
					style={[styles.action, styles.favorite]}
					testID={`note-swipe-favorite-${props.noteId}`}
					onPress={props.onFavorite}
				>
					<Star
						color={mobileColors.textInverse}
						size={24}
						weight={props.favorite ? "fill" : "regular"}
					/>
				</Button>
			</Animated.View>
			<Animated.View style={style}>
				<Button
					accessibilityLabel={mobileText("command.note.deleteNote")}
					style={[styles.action, styles.delete]}
					testID={`note-swipe-delete-${props.noteId}`}
					onPress={props.onDelete}
				>
					<Trash color={mobileColors.textInverse} size={24} />
				</Button>
			</Animated.View>
		</>
	);
}

function SwipePrimaryAction({
	props,
	styles,
	mobileColors,
	organizeIsPrimary,
}: {
	props: ActionProps;
	styles: ReturnType<typeof createThemeStyles>["styles"];
	mobileColors: MobileColors;
	organizeIsPrimary: boolean;
}) {
	return organizeIsPrimary ? (
		<Button
			accessibilityLabel={mobileText("noteList.bulk.organize")}
			style={[styles.action, styles.archive]}
			testID={`note-swipe-organize-${props.noteId}`}
			onPress={props.onOrganize}
		>
			<CheckCircle color={mobileColors.textInverse} size={24} />
		</Button>
	) : (
		<ArchiveButton props={props} styles={styles} mobileColors={mobileColors} />
	);
}

function ArchiveButton({
	props,
	styles,
	mobileColors,
}: {
	props: ActionProps;
	styles: ReturnType<typeof createThemeStyles>["styles"];
	mobileColors: MobileColors;
}) {
	return (
		<Button
			accessibilityLabel={mobileText(
				props.archived
					? "command.note.unarchiveNote"
					: "command.note.archiveNote",
			)}
			style={[styles.action, styles.archive]}
			testID={`note-swipe-archive-${props.noteId}`}
			onPress={props.onArchive}
		>
			<ArchiveIcon color={mobileColors.textInverse} size={24} />
		</Button>
	);
}

function createThemeStyles(mobileColors: MobileColors) {
	const styles = StyleSheet.create({
		actions: {
			position: "absolute",
			top: 0,
			bottom: 0,
			right: 0,
			flexDirection: "row",
		},
		action: {
			flex: 1,
			height: "100%",
			borderRadius: 0,
			padding: 0,
			alignItems: "center",
			justifyContent: "center",
		},
		favorite: { backgroundColor: mobileColors.primary },
		archive: { backgroundColor: mobileColors.green },
		delete: { backgroundColor: mobileColors.danger },
	});
	return { mobileColors, styles };
}
