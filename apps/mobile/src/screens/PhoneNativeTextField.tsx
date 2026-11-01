import { TextInput } from "react-native";

export function PhoneNativeTextField(props: {
	label: string;
	value: string;
	keyboardType: "number" | "url" | "text";
	onChange: (value: string) => void;
	onCommit: () => void;
}) {
	return (
		<TextInput
			accessibilityLabel={props.label}
			keyboardType={
				props.keyboardType === "number"
					? "decimal-pad"
					: props.keyboardType === "url"
						? "url"
						: "default"
			}
			returnKeyType="done"
			value={props.value}
			onChangeText={props.onChange}
			onEndEditing={props.onCommit}
		/>
	);
}
