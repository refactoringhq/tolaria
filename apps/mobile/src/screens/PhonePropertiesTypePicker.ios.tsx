import { Host, Picker as SwiftPicker, Text } from "@expo/ui/swift-ui";
import { pickerStyle, tag } from "@expo/ui/swift-ui/modifiers";

export function PhonePropertiesTypePicker(props: {
	value: string;
	options: string[];
	onChange: (value: string) => void;
}) {
	return (
		<Host matchContents={{ vertical: true }}>
			<SwiftPicker
				label={props.value}
				selection={props.value}
				modifiers={[pickerStyle("menu")]}
				onSelectionChange={props.onChange}
			>
				{props.options.map((option) => (
					<Text key={option} modifiers={[tag(option)]}>
						{option}
					</Text>
				))}
			</SwiftPicker>
		</Host>
	);
}
