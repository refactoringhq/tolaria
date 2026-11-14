import { ArchiveIcon, CheckCircle, Star, Trash } from "phosphor-react-native";
import type { ComponentProps } from "react";
import { StyleSheet, type ViewStyle } from "react-native";
import Animated, {
	type SharedValue,
	useAnimatedStyle,
	useDerivedValue,
} from "react-native-reanimated";
import { mobileText } from "../../i18n/mobileText";
import { useMobileMotionFrameProbe } from "../../qa/mobileMotionFrameProbe";
import type { MobileColors } from "../../ui/theme/mobilePalette";
import { useMobileStyles } from "../../ui/theme/useMobileTheme";

import { Button } from "../ui/button";
import {
	mobileNoteSwipeActionOrder,
	mobileNoteSwipeButtonWidth,
	mobileNoteSwipePrimaryActionWidth,
	mobileNoteSwipeSecondaryActionWidth,
	mobileNoteSwipeTrayWidth,
} from "./mobileNoteSwipe";

type SwipeActionStyle = ComponentProps<typeof Animated.View>["style"];

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
	const { containerStyle, secondaryStyle, primaryStyle } =
		useSwipeActionWidths(props, actionOrder.length);
	return (
		<Animated.View style={containerStyle}>
			<Animated.View
				style={styles.actions}
				testID={`note-swipe-actions-${props.noteId}`}
			>
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
					style={primaryStyle}
				/>
			</Animated.View>
		</Animated.View>
	);
}

function useSwipeActionWidths(props: ActionProps, actionCount: number) {
	const secondaryWidth = useDerivedValue<number>(() =>
		mobileNoteSwipeSecondaryActionWidth(
			props.translation.get(),
			props.width.get(),
			props.primarySwipeAction,
		),
	);
	const primaryWidth = useDerivedValue<number>(() =>
		mobileNoteSwipePrimaryActionWidth(
			props.translation.get(),
			props.width.get(),
			props.primarySwipeAction,
		),
	);
	const containerStyle = useAnimatedStyle<ViewStyle>(() => ({
		width:
			props.width.get() > 0
				? props.width.get()
				: mobileNoteSwipeTrayWidth(actionCount),
	}));
	const secondaryStyle = useAnimatedStyle<ViewStyle>(() => ({
		width: secondaryWidth.get(),
		overflow: "hidden",
	}));
	const primaryStyle = useAnimatedStyle<ViewStyle>(() => ({
		width: Math.max(mobileNoteSwipeButtonWidth, primaryWidth.get()),
		overflow: "hidden",
	}));
	useMobileMotionFrameProbe(
		`organize-swipe.secondary-width.${props.noteId}`,
		secondaryWidth,
	);
	useMobileMotionFrameProbe(
		`organize-swipe.action-width.${props.noteId}`,
		primaryWidth,
	);
	return { containerStyle, secondaryStyle, primaryStyle };
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
	style: SwipeActionStyle;
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
	style,
}: {
	props: ActionProps;
	styles: ReturnType<typeof createThemeStyles>["styles"];
	mobileColors: MobileColors;
	organizeIsPrimary: boolean;
	style: SwipeActionStyle;
}) {
	return (
		<Animated.View style={style}>
			{organizeIsPrimary ? (
				<Button
					accessibilityLabel={mobileText("command.note.markOrganized")}
					style={[styles.action, styles.archive]}
					testID={`note-swipe-organize-${props.noteId}`}
					onPress={props.onOrganize}
				>
					<CheckCircle color={mobileColors.textInverse} size={24} />
				</Button>
			) : (
				<ArchiveButton
					props={props}
					styles={styles}
					mobileColors={mobileColors}
				/>
			)}
		</Animated.View>
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
			flexDirection: "row",
			justifyContent: "flex-end",
			alignItems: "stretch",
			height: "100%",
			width: "100%",
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
