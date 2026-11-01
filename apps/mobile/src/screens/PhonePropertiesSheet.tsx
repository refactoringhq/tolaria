import { BottomSheet, BottomSheetView } from "@expo/ui/community/bottom-sheet";
import { StyleSheet } from "react-native";
import { PhonePropertiesSheetContent } from "./PhonePropertiesSheetContent";
import type { PhoneWorkspaceStateViewProps } from "./phoneWorkspaceScreenSupport";

export function PhonePropertiesSheet(props: PhoneWorkspaceStateViewProps) {
	if (props.phoneState !== "properties") return null;

	return (
		<BottomSheet
			index={0}
			snapPoints={["50%", "92%"]}
			enablePanDownToClose
			onClose={props.openEditor}
		>
			<BottomSheetView style={styles.content}>
				<PhonePropertiesSheetContent {...props} />
			</BottomSheetView>
		</BottomSheet>
	);
}

const styles = StyleSheet.create({ content: { flex: 1, minHeight: 0 } });
