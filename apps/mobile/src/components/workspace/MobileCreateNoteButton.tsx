import { Plus } from "phosphor-react-native";
import { StyleSheet } from "react-native";
import { mobileCopy } from "../../i18n/mobileText";
import { logMobileMotionEvent } from "../../qa/mobileMotionFrameLog";
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
	const { styles, mobileColors, createIconSize } =
		useMobileStyles(createActionStyles);
	if (!visible) return null;
	return (
		<MobileListMotion
			pointerEvents="box-none"
			style={StyleSheet.absoluteFill}
			testID="note-list-create-motion"
		>
			<Button
				accessibilityLabel={mobileCopy.createNote}
				className="shadow-md active:opacity-80"
				size="icon"
				style={StyleSheet.flatten(styles.createAction)}
				testID={mobileNoteListCreateChrome.testID}
				onLayout={({ nativeEvent: { layout } }) =>
					logMobileMotionEvent("fab-layout", {
						control: "fab",
						height: layout.height,
						width: layout.width,
						x: layout.x,
						y: layout.y,
					})
				}
				onPress={onPress}
			>
				<Plus color={mobileColors.textInverse} size={createIconSize} />
			</Button>
		</MobileListMotion>
	);
}
