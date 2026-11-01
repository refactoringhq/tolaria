import { FloatingActionButton, Host, Text } from "@expo/ui/jetpack-compose";
import { StyleSheet, View } from "react-native";

export function PhoneNoteListCreateAction(props: {
	onPress: () => void;
	visible: boolean;
}) {
	if (!props.visible) return null;
	return (
		<View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
			<Host matchContents style={styles.position}>
				<FloatingActionButton onClick={props.onPress}>
					<FloatingActionButton.Icon>
						<Text>+</Text>
					</FloatingActionButton.Icon>
				</FloatingActionButton>
			</Host>
		</View>
	);
}

const styles = StyleSheet.create({
	position: { bottom: 16, position: "absolute", right: 16 },
});
