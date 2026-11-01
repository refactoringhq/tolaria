import { DateTimePicker } from "@expo/ui/community/datetime-picker";
import { Picker } from "@expo/ui/community/picker";
import { useState } from "react";
import {
	mobilePropertyValueKind,
	parseMobilePropertyValue,
} from "../workspace/mobilePropertyValues";
import type {
	MobilePropertyDisplayMode,
	MobilePropertyValue,
	MobileTypeDefinitions,
} from "../workspace/mobileWorkspaceModel";
import { mobilePropertyValueSuggestions } from "../workspace/mobileWorkspaceSuggestions";
import { PhoneNativeBooleanControl } from "./PhoneNativeBooleanControl";
import { PhoneNativeColorInput } from "./PhoneNativeColorInput";
import { PhoneNativeTextField } from "./PhoneNativeTextField";

export function PhoneNativePropertyControl(props: {
	keyName: string;
	label: string;
	value: MobilePropertyValue;
	displayModes?: Record<string, MobilePropertyDisplayMode> | null;
	typeDefinitions?: MobileTypeDefinitions;
	notes: Parameters<typeof mobilePropertyValueSuggestions>[0];
	selectedNoteId: string;
	onCommit: (value: MobilePropertyValue) => void;
}) {
	const kind = mobilePropertyValueKind(
		props.keyName,
		props.value,
		props.displayModes,
	);
	const textValue = Array.isArray(props.value)
		? props.value.join(", ")
		: String(props.value);
	const [draft, setDraft] = useState(textValue);

	if (kind === "boolean")
		return (
			<PhoneNativeBooleanControl
				label={props.label}
				value={props.value === true}
				onChange={props.onCommit}
			/>
		);
	if (kind === "date")
		return (
			<DateTimePicker
				value={safeDate(textValue)}
				mode="date"
				display="compact"
				onValueChange={(_, date) =>
					props.onCommit(date.toISOString().slice(0, 10))
				}
			/>
		);
	if (kind === "status") return <StatusPicker {...props} />;
	if (kind === "color")
		return (
			<PhoneNativeColorInput
				label={props.label}
				value={textValue}
				onCommit={props.onCommit}
			/>
		);

	return (
		<PhoneNativeTextField
			label={props.label}
			value={draft}
			keyboardType={
				kind === "number" ? "number" : kind === "url" ? "url" : "text"
			}
			onChange={setDraft}
			onCommit={() => {
				if (draft === textValue) return;
				props.onCommit(
					parseMobilePropertyValue({
						key: props.keyName,
						kind,
						valueText: draft,
					}),
				);
			}}
		/>
	);
}

function StatusPicker(props: Parameters<typeof PhoneNativePropertyControl>[0]) {
	const selectedValue = typeof props.value === "string" ? props.value : "";
	const options = [
		...new Set([
			selectedValue,
			...mobilePropertyValueSuggestions(
				props.notes,
				props.keyName,
				"",
				"status",
				{
					selectedNote:
						props.notes.find((note) => note.id === props.selectedNoteId) ??
						null,
					typeDefinitions: props.typeDefinitions,
				},
			),
		]),
	].filter(Boolean);

	return (
		<Picker
			selectedValue={selectedValue}
			onValueChange={(value) => props.onCommit(String(value))}
		>
			{options.map((option) => (
				<Picker.Item key={option} label={option} value={option} />
			))}
		</Picker>
	);
}

function safeDate(value: string): Date {
	const date = new Date(`${value}T12:00:00`);
	return Number.isNaN(date.getTime()) ? new Date() : date;
}
