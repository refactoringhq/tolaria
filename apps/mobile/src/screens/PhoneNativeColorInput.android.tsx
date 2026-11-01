import { TextField, useNativeState } from "@expo/ui/jetpack-compose";
import { useEffect, useRef } from "react";

export function PhoneNativeColorInput(props: {
	label: string;
	value: string;
	onCommit: (value: string) => void;
}) {
	const value = useNativeState(props.value);
	const pending = useRef(props.value);
	useEffect(() => {
		pending.current = props.value;
		value.set(props.value);
	}, [props.value, value]);
	return (
		<TextField
			value={value}
			onValueChange={(next) => {
				pending.current = next;
			}}
			onFocusChanged={(focused) => {
				if (!focused && pending.current !== props.value)
					props.onCommit(pending.current);
			}}
		>
			<TextField.Label>{props.label}</TextField.Label>
		</TextField>
	);
}
