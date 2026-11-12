import { Plus } from "phosphor-react-native";
import { useContext } from "react";
import { StyleSheet } from "react-native";
import Reanimated, {
	runOnJS,
	useAnimatedStyle,
	useFrameCallback,
	useSharedValue,
} from "react-native-reanimated";
import { mobileCopy } from "../../i18n/mobileText";
import { logMobileMotionEvent } from "../../qa/mobileMotionFrameLog";
import { logMobileMotionFrame } from "../../qa/mobileMotionFrameProbe";
import {
	type PhoneWorkspaceMotion,
	PhoneWorkspaceMotionContext,
} from "../../screens/PhoneWorkspaceMotionContext";
import { useMobileStyles } from "../../ui/theme/useMobileTheme";
import { Button } from "../ui/button";
import { createActionStyles } from "./MobileNoteListPanel.styles";
import { mobileNoteListCreateChrome } from "./MobileNoteListPanelChrome";
import { MobileListMotion } from "./MobileSwipeableNoteRow";

export function MobileCreateNoteButton({
	onPress,
	visible,
}: {
	onPress: () => void;
	visible: boolean;
}) {
	const motion = useContext(PhoneWorkspaceMotionContext);
	const { layoutX, positionStyle } = useFabMotion(motion);
	const { styles, mobileColors, createIconSize } =
		useMobileStyles(createActionStyles);
	if (!visible || motion?.isListActive === false) return null;
	return (
		<MobileListMotion
			pointerEvents="box-none"
			style={StyleSheet.absoluteFill}
			testID="note-list-create-motion"
		>
			<Reanimated.View
				pointerEvents="box-none"
				style={[StyleSheet.absoluteFill, positionStyle]}
			>
				<Button
					accessibilityLabel={mobileCopy.createNote}
					className="shadow-md active:opacity-80"
					size="icon"
					style={StyleSheet.flatten(styles.createAction)}
					testID={mobileNoteListCreateChrome.testID}
					onLayout={({ nativeEvent: { layout } }) => {
						layoutX.set(layout.x);
						logMobileMotionEvent("fab-layout", {
							control: "fab",
							height: layout.height,
							width: layout.width,
							x: layout.x,
							y: layout.y,
						});
					}}
					onPress={onPress}
				>
					<Plus color={mobileColors.textInverse} size={createIconSize} />
				</Button>
			</Reanimated.View>
		</MobileListMotion>
	);
}

function useFabMotion(motion: PhoneWorkspaceMotion | null) {
	const layoutX = useSharedValue(0);
	const previousOffset = useSharedValue(Number.NaN);
	const railOffset = motion?.railOffset;
	const listPageOrigin = motion?.listPageOrigin ?? 0;
	const probeEnabled = motion?.probeEnabled ?? false;
	const positionStyle = useAnimatedStyle(() => ({
		transform: [{ translateX: -((railOffset?.get() ?? 0) + listPageOrigin) }],
	}));
	useFrameCallback((frame) => {
		"worklet";
		const offset = railOffset?.get() ?? 0;
		const previous = previousOffset.get();
		if (shouldLogFabFrame(probeEnabled, previous, offset)) {
			runOnJS(logMobileMotionFrame)(
				"phone.fab.viewport.x",
				frame.timestamp,
				frame.timeSincePreviousFrame ?? 0,
				layoutX.get(),
			);
		}
		previousOffset.set(offset);
	}, probeEnabled);
	return { layoutX, positionStyle };
}

function shouldLogFabFrame(enabled: boolean, previous: number, offset: number) {
	"worklet";
	return (
		enabled && Number.isFinite(previous) && Math.abs(offset - previous) > 0.01
	);
}
