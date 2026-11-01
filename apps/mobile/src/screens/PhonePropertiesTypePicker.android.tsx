import { Picker } from "@expo/ui/community/picker";

export function PhonePropertiesTypePicker(props: {
	value: string;
	options: string[];
	onChange: (value: string) => void;
}) {
	return (
		<Picker
			selectedValue={props.value}
			onValueChange={(value) => props.onChange(String(value))}
		>
			{props.options.map((option) => (
				<Picker.Item key={option} label={option} value={option} />
			))}
		</Picker>
	);
}
