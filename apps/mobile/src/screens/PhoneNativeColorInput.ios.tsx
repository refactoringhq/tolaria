import { ColorPicker } from "@expo/ui/swift-ui";

export function PhoneNativeColorInput(props: {
	label: string;
	value: string;
	onCommit: (value: string) => void;
}) {
	return (
		<ColorPicker
			label={props.label}
			selection={props.value || "#ffffff"}
			onSelectionChange={props.onCommit}
		/>
	);
}
