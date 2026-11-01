import { Toggle } from "@expo/ui/swift-ui";

export function PhoneNativeBooleanControl(props: {
	label: string;
	value: boolean;
	onChange: (value: boolean) => void;
}) {
	return (
		<Toggle
			label={props.label}
			isOn={props.value}
			onIsOnChange={props.onChange}
		/>
	);
}
