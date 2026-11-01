import { TextField, useNativeState } from "@expo/ui/swift-ui";
import { useEffect, useRef } from "react";

export function PhoneNativeTextField(props: {
	label: string;
	value: string;
	keyboardType: "number" | "url" | "text";
	onChange: (value: string) => void;
	onCommit: () => void;
}) {
	const value = useNativeState(props.value);
	const pending = useRef(props.value);
	useEffect(() => {
		pending.current = props.value;
		value.set(props.value);
	}, [props.value, value]);

	return (
		<TextField
			text={value}
			placeholder={props.label}
			onTextChange={(next) => {
				pending.current = next;
				props.onChange(next);
			}}
			onFocusChange={(focused) => {
				if (!focused && pending.current !== props.value) props.onCommit();
			}}
		/>
	);
}
