import { type ReactNode, useMemo } from "react";
import type { LayoutChangeEvent, StyleProp, ViewStyle } from "react-native";
import Animated, {
	FadeInDown,
	FadeOutUp,
	LinearTransition,
	type SharedValue,
	SlideInLeft,
	SlideOutLeft,
	useAnimatedRef,
	useAnimatedStyle,
	useReducedMotion,
} from "react-native-reanimated";
import { logMobileMotionEvent } from "../../qa/mobileMotionFrameLog";
import {
	mobileMotionFrameProbeEnabled,
	useMobileMotionGeometryProbe,
} from "../../qa/mobileMotionFrameProbe";

type MotionProps = {
	children: ReactNode;
	testID?: string;
	variant?: "row" | "surface";
	style?: StyleProp<ViewStyle>;
	pointerEvents?: "auto" | "none" | "box-none" | "box-only";
	motionProbeId?: string;
	exitProgress?: SharedValue<number>;
	rowHeight?: SharedValue<number>;
	disableLayoutTransition?: boolean;
};

export function MobileListMotion(props: MotionProps) {
	const {
		children,
		testID,
		variant = "surface",
		style,
		pointerEvents,
		motionProbeId,
		exitProgress,
		rowHeight,
		disableLayoutTransition,
	} = props;
	const reduceMotion = useReducedMotion();
	const geometryRef = useAnimatedRef<Animated.View>();
	useMobileMotionGeometryProbe(motionProbeId ?? "", geometryRef, rowHeight);
	const onLayout = useMemoizedMotionLayout(motionProbeId, rowHeight);
	const exitStyle = useAnimatedStyle(
		() => getExitStyle(exitProgress?.get() ?? 0, rowHeight?.get() ?? 0),
		[exitProgress, rowHeight],
	);
	const row = variant === "row";
	const skipTransition = reduceMotion || disableLayoutTransition;
	return (
		<Animated.View
			ref={geometryRef}
			entering={skipTransition ? undefined : getEnteringAnimation(false, row)}
			exiting={skipTransition ? undefined : getExitingAnimation(false, row)}
			layout={skipTransition ? undefined : LinearTransition.duration(180)}
			onLayout={onLayout}
			pointerEvents={pointerEvents}
			style={[style, exitStyle]}
			testID={testID}
		>
			{children}
		</Animated.View>
	);
}

function getExitStyle(progress: number, height: number): ViewStyle {
	"worklet";
	return progress > 0
		? { height: height * (1 - progress), overflow: "hidden" }
		: {};
}

function getEnteringAnimation(reduceMotion: boolean, row: boolean) {
	if (reduceMotion) return undefined;
	return row ? SlideInLeft.duration(220) : FadeInDown.duration(180);
}

function getExitingAnimation(reduceMotion: boolean, row: boolean) {
	if (reduceMotion) return undefined;
	return row ? SlideOutLeft.duration(220) : FadeOutUp.duration(140);
}

function useMemoizedMotionLayout(
	motionProbeId: string | undefined,
	rowHeight: SharedValue<number> | undefined,
) {
	return useMemo(
		() =>
			rowHeight || (motionProbeId && mobileMotionFrameProbeEnabled)
				? (event: LayoutChangeEvent) => {
						if (rowHeight && rowHeight.get() === 0) {
							rowHeight.set(event.nativeEvent.layout.height);
						}
						if (motionProbeId && mobileMotionFrameProbeEnabled)
							logSwipeRowLayout(motionProbeId, event);
					}
				: undefined,
		[motionProbeId, rowHeight],
	);
}

function logSwipeRowLayout(noteId: string, event: LayoutChangeEvent) {
	const { x, y, width, height } = event.nativeEvent.layout;
	logMobileMotionEvent("swipe-row-layout", {
		height,
		noteId,
		width,
		x,
		y,
	});
}
