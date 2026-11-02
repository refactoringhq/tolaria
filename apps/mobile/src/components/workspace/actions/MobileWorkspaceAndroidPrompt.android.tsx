import {
	AlertDialog,
	Button,
	Text as ComposeText,
	OutlinedTextField,
	useNativeState,
} from "@expo/ui/jetpack-compose";
import { useRef, useState } from "react";
import { mobileText } from "../../../i18n/mobileText";
import { submitPromptValueAfterStateUpdate } from "../../ui/mobileNativeDialogs";
import type { ActionContentProps } from "../MobileWorkspaceActionSheet.types";
import {
	type MobileWorkspacePromptAction,
	promptChangeHandler,
	promptInitialValue,
	promptTitle,
	submitPromptValue,
	validatePromptValue,
} from "../MobileWorkspaceNativePrompt";

export function MobileWorkspaceAndroidPrompt(props: ActionContentProps) {
	const action = props.action as MobileWorkspacePromptAction;
	const initialValue = promptInitialValue(props, action);
	const text = useNativeState(initialValue);
	const latestValue = useRef(initialValue);
	const [error, setError] = useState<string | null>(null);
	const onChange = promptChangeHandler(props, action);
	const onSubmit = () => submitPromptValue(props, action);
	const submit = () => {
		const validationError = validatePromptValue(
			props,
			action,
			latestValue.current,
		);
		if (validationError) {
			setError(validationError);
			return;
		}
		submitPromptValueAfterStateUpdate(latestValue.current, onChange, onSubmit);
	};

	return (
		<AlertDialog onDismissRequest={props.onClose}>
			<AlertDialog.Title>
				<ComposeText>{promptTitle(action)}</ComposeText>
			</AlertDialog.Title>
			<AlertDialog.Text>
				<OutlinedTextField
					autoFocus
					value={text}
					singleLine
					onValueChange={(value) => {
						latestValue.current = value;
						text.set(value);
						onChange(value);
						setError(null);
					}}
				>
					<OutlinedTextField.Label>
						{promptTitle(action)}
					</OutlinedTextField.Label>
				</OutlinedTextField>
				{error ? <ComposeText>{error}</ComposeText> : null}
			</AlertDialog.Text>
			<AlertDialog.DismissButton>
				<Button onClick={props.onClose}>
					<ComposeText>{mobileText("common.cancel")}</ComposeText>
				</Button>
			</AlertDialog.DismissButton>
			<AlertDialog.ConfirmButton>
				<Button onClick={submit}>
					<ComposeText>
						{action === "renameNoteFile"
							? mobileText("common.save")
							: mobileText("common.create")}
					</ComposeText>
				</Button>
			</AlertDialog.ConfirmButton>
		</AlertDialog>
	);
}
