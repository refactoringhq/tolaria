import { TextInput } from "react-native";

export function PhoneNativeColorInput(props: {
	label: string;
	value: string;
	onCommit: (value: string) => void;
}) {
	return (
		<TextInput
			accessibilityLabel="Color"
			defaultValue={props.value}
			onEndEditing={(event) => props.onCommit(event.nativeEvent.text)}
		/>
	);
}
