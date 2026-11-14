import {
	type ComponentProps,
	type ReactNode,
	useCallback,
	useMemo,
	useRef,
	useState,
} from "react";
import { Vibration, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Swipeable, {
	type SwipeableMethods,
} from "react-native-gesture-handler/ReanimatedSwipeable";
import Animated, {
	runOnJS,
	type SharedValue,
	useAnimatedReaction,
	useAnimatedStyle,
	useDerivedValue,
	useSharedValue,
	withDelay,
	withTiming,
} from "react-native-reanimated";
import { useMobileAnalytics } from "../../analytics/useMobileAnalytics";
import { logMobileMotionEvent } from "../../qa/mobileMotionFrameLog";
import {
	mobileMotionGeometryCaptureActive,
	stopMobileMotionGeometryCapture,
	useMobileMotionFrameProbe,
} from "../../qa/mobileMotionFrameProbe";
import { useMobileColors } from "../../ui/theme/useMobileTheme";
import type { MobileNote } from "../../workspace/mobileWorkspaceModel";
import { MobileListMotion } from "./MobileListMotion.internal";
import { MobileNoteSwipeActions } from "./MobileNoteSwipeActions";
import {
	fullSwipeNoteAction,
	type MobileNoteSwipeAction,
} from "./mobileNoteSwipe";

export { MobileListMotion } from "./MobileListMotion.internal";

const revealHoldMs =
	process.env.NODE_ENV === "development"
		? Math.max(
				0,
				Number(process.env.EXPO_PUBLIC_TOLARIA_MOTION_REVEAL_HOLD_MS ?? 0),
			)
		: 0;

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

type SwipeActionProps = ComponentProps<typeof MobileNoteSwipeActions>;

export function MobileSwipeableNoteRow(props: Props) {
	const exitProgress = useSharedValue(0);
	const rowHeight = useSharedValue(0);
	const [dismissing, setDismissing] = useState(false);
	const row =
		!props.actions || props.disabled ? (
			props.children
		) : (
			<SwipeableNoteRow
				{...props}
				actions={props.actions}
				exitProgress={exitProgress}
				onDismissing={setDismissing}
			/>
		);
	return (
		<MobileListMotion
			disableLayoutTransition={dismissing}
			exitProgress={props.actions && !props.disabled ? exitProgress : undefined}
			motionProbeId={props.note.id}
			rowHeight={rowHeight}
			variant="row"
		>
			{row}
		</MobileListMotion>
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
			performSwipeAction({
				action,
				actions,
				noteId: note.id,
				archived: note.archived ?? false,
				swipeable: swipeable.current,
			});
			analytics.capture({ name: "mobile_note_swipe_used", action });
		},
		[actions, analytics, note.id, note.archived],
	);
	return { perform, swipeable };
}

function performSwipeAction({
	action,
	archived,
	actions,
	noteId,
	swipeable,
}: {
	action: MobileNoteSwipeAction | "delete";
	archived: boolean;
	actions: MobileNoteRowActions;
	noteId: string;
	swipeable: SwipeableMethods | null;
}) {
	switch (action) {
		case "favorite":
			swipeable?.close();
			actions.onToggleFavorite(noteId);
			break;
		case "archive":
			actions.onArchive([noteId], !archived);
			break;
		case "organize":
			actions.onOrganize([noteId]);
			break;
		case "delete":
			actions.onDelete([noteId]);
			break;
	}
}

function SwipeableNoteRow({
	actions,
	children,
	note,
	exitProgress,
	onDismissing,
}: Props & {
	actions: MobileNoteRowActions;
	exitProgress: SharedValue<number>;
	onDismissing: (dismissing: boolean) => void;
}) {
	const mobileColors = useMobileColors();
	const { perform, swipeable } = useSwipeableNoteActions(actions, note);
	const width = useSharedValue(0);
	const gestureTranslation = useSharedValue(0);
	const swipeTranslation = useSharedValue(0);
	const heldFullSwipeOffset = useSharedValue(0);
	const holdingFullSwipeOffset = useSharedValue(false);
	const fullSwipeExitOffset = useSharedValue(0);
	const committed = useSharedValue(false);
	const hapticPlayed = useSharedValue(false);
	const loggedFullReveal = useSharedValue(false);
	const commitSwipeAction = useCallback(
		(action: MobileNoteSwipeAction) => {
			logMobileMotionEvent("swipe-action-commit", {
				action,
				noteId: note.id,
				rowWidth: width.get(),
			});
			perform(action);
		},
		[note.id, perform, width],
	);
	const logFullReveal = useCallback(() => {
		if (actions.primarySwipeAction !== "organize") return;
		const rowWidth = width.get();
		logMobileMotionEvent("organize-swipe-full-reveal", {
			action: "organize",
			actionWidth: rowWidth,
			checkOnly: true,
			noteId: note.id,
			rowWidth,
			secondaryActionsVisible: false,
		});
	}, [actions.primarySwipeAction, note.id, width]);
	// Swipeable owns dragging/snapping. This simultaneous observer only commits a full swipe on release.
	const fullSwipe = useFullSwipeCommitGesture({
		committed,
		fullSwipeExitOffset,
		exitProgress,
		geometryCapture: mobileMotionGeometryCaptureActive,
		gestureTranslation,
		hapticPlayed,
		heldFullSwipeOffset,
		holdingFullSwipeOffset,
		loggedFullReveal,
		primarySwipeAction: actions.primarySwipeAction,
		onDismissing,
		logFullReveal,
		commitSwipeAction,
		swipeTranslation,
		width,
	});
	const visualTranslation = useDerivedValue(() =>
		holdingFullSwipeOffset.get()
			? heldFullSwipeOffset.get() + fullSwipeExitOffset.get()
			: swipeTranslation.get(),
	);
	const childOffsetStyle = useAnimatedStyle(() => ({
		transform: [
			{
				translateX: visualTranslation.get() - swipeTranslation.get(),
			},
		],
	}));
	const actionProps = {
		archived: note.archived,
		favorite: note.favorite,
		fullSwipeCommitted: committed,
		noteId: note.id,
		onArchive: () => perform("archive"),
		onDelete: () => perform("delete"),
		onFavorite: () => perform("favorite"),
		onOrganize: () => perform("organize"),
		primarySwipeAction: actions.primarySwipeAction,
		translation: visualTranslation,
		width,
	};
	return (
		<SwipeableRowSurface
			actionProps={actionProps}
			childOffsetStyle={childOffsetStyle}
			children={children}
			fullSwipe={fullSwipe}
			gestureTranslation={gestureTranslation}
			mobileCardColor={mobileColors.card}
			noteId={note.id}
			swipeable={swipeable}
			swipeTranslation={swipeTranslation}
			visualTranslation={visualTranslation}
			width={width}
		/>
	);
}

function SwipeableRowSurface({
	actionProps,
	childOffsetStyle,
	children,
	fullSwipe,
	gestureTranslation,
	mobileCardColor,
	noteId,
	swipeable,
	swipeTranslation,
	visualTranslation,
	width,
}: {
	actionProps: SwipeActionProps;
	childOffsetStyle: ComponentProps<typeof Animated.View>["style"];
	children: ReactNode;
	fullSwipe: ReturnType<typeof useFullSwipeCommitGesture>;
	gestureTranslation: SharedValue<number>;
	mobileCardColor: string;
	noteId: string;
	swipeable: { current: SwipeableMethods | null };
	swipeTranslation: SharedValue<number>;
	visualTranslation: SharedValue<number>;
	width: SharedValue<number>;
}) {
	return (
		<GestureDetector gesture={fullSwipe}>
			<View onLayout={(event) => width.set(event.nativeEvent.layout.width)}>
				<Swipeable
					ref={swipeable}
					childrenContainerStyle={{ backgroundColor: mobileCardColor }}
					enableTrackpadTwoFingerGesture={false}
					friction={1}
					overshootFriction={1}
					dragOffsetFromLeftEdge={Number.MAX_SAFE_INTEGER}
					overshootLeft={false}
					overshootRight={false}
					simultaneousWithExternalGesture={fullSwipe}
					renderRightActions={(_, translation) => (
						<SwipeableRowActions
							actionProps={actionProps}
							gestureTranslation={gestureTranslation}
							noteId={noteId}
							swipeTranslation={swipeTranslation}
							translation={translation}
							visualTranslation={visualTranslation}
						/>
					)}
				>
					<Animated.View style={childOffsetStyle}>{children}</Animated.View>
				</Swipeable>
			</View>
		</GestureDetector>
	);
}

function SwipeableRowActions({
	actionProps,
	gestureTranslation,
	noteId,
	swipeTranslation,
	translation,
	visualTranslation,
}: {
	actionProps: SwipeActionProps;
	gestureTranslation: SharedValue<number>;
	noteId: string;
	swipeTranslation: SharedValue<number>;
	translation: SharedValue<number>;
	visualTranslation: SharedValue<number>;
}) {
	return (
		<>
			<MobileNoteSwipeActions {...actionProps} />
			<SwipeTranslationMotionProbe
				gestureTranslation={gestureTranslation}
				noteId={noteId}
				swipeTranslation={swipeTranslation}
				translation={translation}
				visualTranslation={visualTranslation}
			/>
		</>
	);
}

function SwipeTranslationMotionProbe({
	noteId,
	translation,
	gestureTranslation,
	swipeTranslation,
	visualTranslation,
}: {
	noteId: string;
	translation: SharedValue<number>;
	gestureTranslation: SharedValue<number>;
	swipeTranslation: SharedValue<number>;
	visualTranslation: SharedValue<number>;
}) {
	useAnimatedReaction(
		() => translation.get(),
		(value) => swipeTranslation.set(value),
		[swipeTranslation],
	);
	useMobileMotionFrameProbe(`organize-swipe.${noteId}`, visualTranslation);
	useMobileMotionFrameProbe(
		`organize-swipe-gesture.${noteId}`,
		gestureTranslation,
	);
	return null;
}

type FullSwipeGestureConfig = {
	committed: SharedValue<boolean>;
	fullSwipeExitOffset: SharedValue<number>;
	exitProgress: SharedValue<number>;
	geometryCapture: SharedValue<boolean>;
	gestureTranslation: SharedValue<number>;
	hapticPlayed: SharedValue<boolean>;
	heldFullSwipeOffset: SharedValue<number>;
	holdingFullSwipeOffset: SharedValue<boolean>;
	loggedFullReveal: SharedValue<boolean>;
	primarySwipeAction?: "archive" | "organize";
	onDismissing: (dismissing: boolean) => void;
	logFullReveal: () => void;
	commitSwipeAction: (action: MobileNoteSwipeAction) => void;
	swipeTranslation: SharedValue<number>;
	width: SharedValue<number>;
};

function useFullSwipeCommitGesture(config: FullSwipeGestureConfig) {
	const {
		committed,
		fullSwipeExitOffset,
		exitProgress,
		geometryCapture,
		gestureTranslation,
		hapticPlayed,
		heldFullSwipeOffset,
		holdingFullSwipeOffset,
		loggedFullReveal,
		primarySwipeAction,
		onDismissing,
		logFullReveal,
		commitSwipeAction,
		swipeTranslation,
		width,
	} = config;
	return useMemo(
		() => {
			const commitIfNeeded = (translationX: number) => {
				"worklet";
				const action = fullSwipeNoteAction(
					translationX,
					width.get(),
					primarySwipeAction,
				);
				if (!action || committed.get()) return;
				committed.set(true);
				geometryCapture.set(true);
				if (!loggedFullReveal.get()) {
					loggedFullReveal.set(true);
					runOnJS(logFullReveal)();
				}
				runOnJS(onDismissing)(true);
				const currentOffset = swipeTranslation.get();
				heldFullSwipeOffset.set(currentOffset);
				holdingFullSwipeOffset.set(true);
				const exitAnimation = withTiming(
					-width.get() - currentOffset,
					{ duration: 120 },
					(exited) => {
						if (!exited) return;
						const collapse = withTiming(
							1,
							{ duration: 180 },
							(collapsed) => {
								if (collapsed) {
									runOnJS(stopMobileMotionGeometryCapture)();
									runOnJS(commitSwipeAction)(action);
								}
							},
						);
						exitProgress.set(withDelay(revealHoldMs, collapse));
					},
				);
				fullSwipeExitOffset.set(exitAnimation);
			};
			return Gesture.Pan()
				.activeOffsetX(-16)
				.failOffsetX(16)
				.failOffsetY([-12, 12])
				.onStart(() => {
					// Ignore only while a commit collapse is in flight so the row
					// cannot bounce back open. A later swipe on a reused row is ok.
					if (committed.get() && exitProgress.get() < 1) return;
					committed.set(false);
					gestureTranslation.set(0);
					holdingFullSwipeOffset.set(false);
					fullSwipeExitOffset.set(0);
					exitProgress.set(0);
					geometryCapture.set(false);
					hapticPlayed.set(false);
					loggedFullReveal.set(false);
				})
				.onUpdate((event) => {
					if (committed.get()) return;
					gestureTranslation.set(event.translationX);
					const action = fullSwipeNoteAction(
						event.translationX,
						width.get(),
						primarySwipeAction,
					);
					if (action && !hapticPlayed.get()) {
						hapticPlayed.set(true);
						runOnJS(emitSwipeHaptic)();
					}
					if (
						width.get() > 0 &&
						event.translationX <= -width.get() &&
						!loggedFullReveal.get()
					) {
						loggedFullReveal.set(true);
						runOnJS(logFullReveal)();
					}
				})
				.onEnd((event) => {
					"worklet";
					commitIfNeeded(event.translationX);
				})
				.onFinalize(() => {
					"worklet";
					commitIfNeeded(gestureTranslation.get());
				});
		},
		[
			committed,
			commitSwipeAction,
			fullSwipeExitOffset,
			exitProgress,
			geometryCapture,
			gestureTranslation,
			hapticPlayed,
			heldFullSwipeOffset,
			holdingFullSwipeOffset,
			logFullReveal,
			loggedFullReveal,
			onDismissing,
			primarySwipeAction,
			swipeTranslation,
			width,
		],
	);
}

function emitSwipeHaptic() {
	Vibration.vibrate(10);
}
