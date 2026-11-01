import { Switch } from "@expo/ui/jetpack-compose";

export function PhoneNativeBooleanControl(props: {
	label: string;
	value: boolean;
	onChange: (value: boolean) => void;
}) {
	return <Switch value={props.value} onCheckedChange={props.onChange} />;
}
