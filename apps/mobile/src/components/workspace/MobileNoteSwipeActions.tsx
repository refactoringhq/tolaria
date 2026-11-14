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
	mobileNoteSwipeSecondaryActionWidth,
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
	fullSwipeCommitted: SharedValue<boolean>;
	fullSwipePreview: boolean;
	fullSwipeRevealed: SharedValue<boolean>;
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
	const { expansion, secondaryStyle } = useSwipeActionWidths(props, baseWidth);
	return (
		<Animated.View
			style={[props.fullSwipePreview && styles.fullSwipeReveal, expansion]}
		>
			<Animated.View
				style={[styles.actions, expansion]}
				testID={`note-swipe-actions-${props.noteId}`}
			>
				{props.fullSwipePreview ? null : (
					<SwipeSecondaryActions
						props={props}
						styles={styles}
						mobileColors={mobileColors}
						style={secondaryStyle}
					/>
				)}
				<SwipePrimaryAction
					props={props}
					styles={styles}
					mobileColors={mobileColors}
					organizeIsPrimary={organizeIsPrimary}
					fullSwipePreview={props.fullSwipePreview}
				/>
			</Animated.View>
		</Animated.View>
	);
}

function useSwipeActionWidths(props: ActionProps, baseWidth: number) {
	const secondaryWidth = useDerivedValue<number>(() =>
		props.fullSwipeRevealed.get()
			? 0
			: mobileNoteSwipeSecondaryActionWidth(
					props.translation.get(),
					props.width.get(),
					props.primarySwipeAction,
					props.fullSwipeCommitted.get(),
				),
	);
	const actionWidth = useDerivedValue<number>(() =>
		props.fullSwipeRevealed.get()
			? props.width.get()
			: Math.max(baseWidth, Math.abs(props.translation.get())),
	);
	const expansion = useAnimatedStyle<ViewStyle>(() => ({
		width: actionWidth.get(),
	}));
	const secondaryStyle = useAnimatedStyle<ViewStyle>(() => ({
		width: secondaryWidth.get(),
		overflow: "hidden",
	}));
	useMobileMotionFrameProbe(
		`organize-swipe.secondary-width.${props.noteId}`,
		secondaryWidth,
	);
	useMobileMotionFrameProbe(
		`organize-swipe.action-width.${props.noteId}`,
		actionWidth,
	);
	return { expansion, secondaryStyle };
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
	fullSwipePreview,
}: {
	props: ActionProps;
	styles: ReturnType<typeof createThemeStyles>["styles"];
	mobileColors: MobileColors;
	organizeIsPrimary: boolean;
	fullSwipePreview: boolean;
}) {
	return organizeIsPrimary ? (
		<Button
			accessibilityLabel={mobileText("command.note.markOrganized")}
			style={[
				styles.action,
				fullSwipePreview && styles.fullSwipePrimaryAction,
				styles.archive,
			]}
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
		fullSwipeReveal: {
			position: "absolute",
			left: 0,
			top: 0,
			bottom: 0,
			right: 0,
		},
		actions: {
			position: "absolute",
			top: 0,
			bottom: 0,
			left: 0,
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
		fullSwipePrimaryAction: { width: "100%" },
		favorite: { backgroundColor: mobileColors.primary },
		archive: { backgroundColor: mobileColors.green },
		delete: { backgroundColor: mobileColors.danger },
	});
	return { mobileColors, styles };
}
