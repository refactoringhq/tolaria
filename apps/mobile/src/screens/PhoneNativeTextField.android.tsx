import { OutlinedTextField, useNativeState } from "@expo/ui/jetpack-compose";
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
		<OutlinedTextField
			value={value}
			keyboardOptions={{
				keyboardType:
					props.keyboardType === "number"
						? "number"
						: props.keyboardType === "url"
							? "uri"
							: "text",
				imeAction: "done",
			}}
			onValueChange={(next) => {
				pending.current = next;
				props.onChange(next);
			}}
			onFocusChanged={(focused) => {
				if (!focused && pending.current !== props.value) props.onCommit();
			}}
			keyboardActions={{ onDone: props.onCommit }}
		>
			<OutlinedTextField.Label>{props.label}</OutlinedTextField.Label>
		</OutlinedTextField>
	);
}
