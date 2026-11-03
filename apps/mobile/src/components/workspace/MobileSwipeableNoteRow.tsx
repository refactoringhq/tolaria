import { type ReactNode, useCallback, useMemo, useRef } from "react";
import { type StyleProp, Vibration, View, type ViewStyle } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Swipeable, {
	type SwipeableMethods,
} from "react-native-gesture-handler/ReanimatedSwipeable";
import Animated, {
	FadeInDown,
	FadeOutUp,
	LinearTransition,
	runOnJS,
	SlideInLeft,
	SlideOutLeft,
	useReducedMotion,
	useSharedValue,
} from "react-native-reanimated";
import { useMobileAnalytics } from "../../analytics/useMobileAnalytics";
import { useMobileColors } from "../../ui/theme/useMobileTheme";
import type { MobileNote } from "../../workspace/mobileWorkspaceModel";
import { MobileNoteSwipeActions } from "./MobileNoteSwipeActions";
import {
	fullSwipeNoteAction,
	type MobileNoteSwipeAction,
} from "./mobileNoteSwipe";

export type MobileNoteRowActions = {
	onArchive: (noteIds: string[], archived: boolean) => void;
	onDelete: (noteIds: string[]) => void;
	onOrganize: (noteIds: string[]) => void;
	onToggleFavorite: (noteId: string) => void;
	primarySwipeAction?: "archive" | "organize";
};

type Props = {
	actions?: MobileNoteRowActions;
	children: ReactNode;
	disabled?: boolean;
	note: MobileNote;
};

export function MobileSwipeableNoteRow(props: Props) {
	const row =
		!props.actions || props.disabled ? (
			props.children
		) : (
			<SwipeableNoteRow {...props} actions={props.actions} />
		);
	return <MobileListMotion variant="row">{row}</MobileListMotion>;
}

export function MobileListMotion({
	children,
	testID,
	variant = "surface",
	style,
	pointerEvents,
}: {
	children: ReactNode;
	testID?: string;
	variant?: "row" | "surface";
	style?: StyleProp<ViewStyle>;
	pointerEvents?: "auto" | "none" | "box-none" | "box-only";
}) {
	const reduceMotion = useReducedMotion();
	if (reduceMotion)
		return (
			<View pointerEvents={pointerEvents} style={style} testID={testID}>
				{children}
			</View>
		);

	const row = variant === "row";
	return (
		<Animated.View
			entering={row ? SlideInLeft.duration(220) : FadeInDown.duration(180)}
			exiting={row ? SlideOutLeft.duration(220) : FadeOutUp.duration(140)}
			layout={LinearTransition.duration(180)}
			pointerEvents={pointerEvents}
			style={style}
			testID={testID}
		>
			{children}
		</Animated.View>
	);
}

function useSwipeableNoteActions(
	actions: MobileNoteRowActions,
	note: MobileNote,
) {
	const analytics = useMobileAnalytics();
	const swipeable = useRef<SwipeableMethods>(null);
	const perform = useCallback(
		(action: MobileNoteSwipeAction | "delete") => {
			if (action === "favorite") swipeable.current?.close();
			if (action === "favorite") actions.onToggleFavorite(note.id);
			if (action === "archive") actions.onArchive([note.id], !note.archived);
			if (action === "organize") actions.onOrganize([note.id]);
			if (action === "delete") actions.onDelete([note.id]);
			analytics.capture({ name: "mobile_note_swipe_used", action });
		},
		[actions, analytics, note.id, note.archived],
	);
	return { perform, swipeable };
}

function SwipeableNoteRow({
	actions,
	children,
	note,
}: Props & { actions: MobileNoteRowActions }) {
	const mobileColors = useMobileColors();
	const { perform, swipeable } = useSwipeableNoteActions(actions, note);
	const width = useSharedValue(0);
	const committed = useSharedValue(false);
	const hapticPlayed = useSharedValue(false);
	// Swipeable owns dragging/snapping. This simultaneous observer only commits a full swipe on release.
	const fullSwipe = useMemo(
		() =>
			Gesture.Pan()
				.activeOffsetX(-16)
				.failOffsetX(16)
				.failOffsetY([-12, 12])
				.onStart(() => {
					committed.set(false);
					hapticPlayed.set(false);
				})
				.onUpdate((event) => {
					const action = fullSwipeNoteAction(
						event.translationX,
						width.get(),
						actions.primarySwipeAction,
					);
					if (action && !hapticPlayed.get()) {
						hapticPlayed.set(true);
						runOnJS(emitSwipeHaptic)();
					}
				})
				.onEnd((event) => {
					const action = fullSwipeNoteAction(
						event.translationX,
						width.get(),
						actions.primarySwipeAction,
					);
					if (action && !committed.get()) {
						committed.set(true);
						runOnJS(perform)(action);
					}
				}),
		[actions.primarySwipeAction, committed, hapticPlayed, perform, width],
	);
	const actionProps = {
		archived: note.archived,
		favorite: note.favorite,
		noteId: note.id,
		onArchive: () => perform("archive"),
		onDelete: () => perform("delete"),
		onFavorite: () => perform("favorite"),
		onOrganize: () => perform("organize"),
		primarySwipeAction: actions.primarySwipeAction,
		width,
	};
	return (
		<GestureDetector gesture={fullSwipe}>
			<View onLayout={(event) => width.set(event.nativeEvent.layout.width)}>
				<Swipeable
					ref={swipeable}
					childrenContainerStyle={{ backgroundColor: mobileColors.card }}
					enableTrackpadTwoFingerGesture={false}
					friction={1}
					overshootFriction={1}
					dragOffsetFromLeftEdge={Number.MAX_SAFE_INTEGER}
					overshootLeft={false}
					simultaneousWithExternalGesture={fullSwipe}
					renderRightActions={(_, translation) => (
						<MobileNoteSwipeActions
							{...actionProps}
							translation={translation}
						/>
					)}
				>
					{children}
				</Swipeable>
			</View>
		</GestureDetector>
	);
}

function emitSwipeHaptic() {
	Vibration.vibrate(10);
}
