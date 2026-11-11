import { type ReactNode, useEffect } from "react";
import { StyleSheet, View, type ViewProps } from "react-native";
import { GestureDetector } from "react-native-gesture-handler";
import Reanimated, { useAnimatedStyle } from "react-native-reanimated";
import { logMobileMotionEvent } from "../qa/mobileMotionFrameLog";
import { useMobileMotionFrameProbe } from "../qa/mobileMotionFrameProbe";
import { PhoneWorkspaceMotionContext } from "./PhoneWorkspaceMotionContext";
import type { PhoneWorkspaceState } from "./phoneWorkspaceTransitions";
import { phoneWorkspaceSidebarDrawerWidth } from "./phoneWorkspaceTransitions";
import type { usePhonePanelRail } from "./usePhonePanelRail";
import { usePhoneViewportWidth } from "./usePhoneViewportWidth";

type Props = {
	children: ReactNode;
	motionProbeEnabled?: boolean;
	panelRail: ReturnType<typeof usePhonePanelRail>;
	phoneState?: PhoneWorkspaceState;
	swipeHandlers?: ViewProps;
};

export function PhoneWorkspaceTransition({
	children,
	motionProbeEnabled = false,
	panelRail,
	phoneState,
	swipeHandlers,
}: Props) {
	const width = usePhoneViewportWidth();
	const { offset } = panelRail;
	useMobileMotionFrameProbe("phone.rail.offset", offset, motionProbeEnabled);
	useEffect(() => {
		if (motionProbeEnabled && phoneState)
			logMobileMotionEvent("phone-state", { state: phoneState });
	}, [motionProbeEnabled, phoneState]);
	const animatedStyle = useAnimatedStyle(() => ({
		transform: [{ translateX: offset.get() }],
	}));
	const stage = (
		<View
			{...swipeHandlers}
			className={panelRail.enabled ? undefined : "!overflow-clip"}
			style={styles.stage}
			testID="phone-transition-stage"
		>
			<Reanimated.View
				style={[
					styles.rail,
					{ width: phoneWorkspaceSidebarDrawerWidth(width) + 3 * width },
					animatedStyle,
				]}
			>
				{children}
			</Reanimated.View>
		</View>
	);
	const motion = {
		isListActive: phoneState === "list",
		listPageOrigin: phoneWorkspaceSidebarDrawerWidth(width),
		probeEnabled: motionProbeEnabled,
		railOffset: offset,
	};
	return (
		<PhoneWorkspaceMotionContext.Provider value={motion}>
			{panelRail.enabled ? (
				<GestureDetector gesture={panelRail.gesture}>{stage}</GestureDetector>
			) : (
				stage
			)}
		</PhoneWorkspaceMotionContext.Provider>
	);
}

const styles = StyleSheet.create({
	rail: { flex: 1 },
	stage: { flex: 1, overflow: "hidden" },
});
