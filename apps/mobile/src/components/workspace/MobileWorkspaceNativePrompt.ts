import { useEffect, useRef } from "react";
import { mobileText } from "../../i18n/mobileText";
import { validateMobileRenameNoteFilePath } from "../../workspace/mobileNotePaths";
import {
	showNativeTextPrompt,
	submitPromptValueAfterStateUpdate,
} from "../ui/mobileNativeDialogs";
import type { ActionContentProps } from "./MobileWorkspaceActionSheet.types";

export type MobileWorkspacePromptAction = Extract<
	ActionContentProps["action"],
	"createFolder" | "createType" | "renameNoteFile"
>;

export function NativeSingleFieldPrompt(props: ActionContentProps) {
	const shown = useRef(false);
	const currentProps = useRef(props);
	useEffect(() => {
		currentProps.current = props;
	});
	useEffect(() => {
		if (shown.current) return;
		shown.current = true;
		const current = currentProps.current;
		const action = current.action as MobileWorkspacePromptAction;
		const initialValue = promptInitialValue(current, action);
		showNativeTextPrompt({
			cancelLabel: mobileText("common.cancel"),
			defaultValue: initialValue,
			onCancel: current.onClose,
			onSubmit: (value) =>
				submitPromptValueAfterStateUpdate(
					value,
					promptChangeHandler(current, action),
					() => submitPromptValue(currentProps.current, action),
				),
			submitLabel:
				action === "renameNoteFile"
					? mobileText("common.save")
					: mobileText("common.create"),
			title: promptTitle(action),
			validate: (value) => validatePromptValue(current, action, value),
		});
	}, [props.action]);
	return null;
}

export function promptTitle(action: MobileWorkspacePromptAction) {
	if (action === "createFolder")
		return mobileText("sidebar.action.createFolder");
	if (action === "createType") return mobileText("sidebar.action.createType");
	return mobileText("editor.filename.rename");
}

export function promptInitialValue(
	props: ActionContentProps,
	action: MobileWorkspacePromptAction,
) {
	if (action === "createFolder") return props.folderName;
	if (action === "createType") return props.typeName;
	return props.filenameStem;
}

export function promptChangeHandler(
	props: ActionContentProps,
	action: MobileWorkspacePromptAction,
) {
	if (action === "createFolder") return props.onFolderNameChange;
	if (action === "createType") return props.onTypeNameChange;
	return props.onFilenameStemChange;
}

export function submitPromptValue(
	props: ActionContentProps,
	action: MobileWorkspacePromptAction,
) {
	if (action === "createFolder") props.onCreateFolder();
	else if (action === "createType") props.onCreateType();
	else props.onRenameNoteFile();
}

export function validatePromptValue(
	props: ActionContentProps,
	action: MobileWorkspacePromptAction,
	value: string,
) {
	const name = value.trim();
	if (!name) return mobileText("workspace.action.nameAlreadyExists");
	if (action === "createType") return validateTypeName(props, name);
	if (action === "createFolder") return validateFolderName(props, name);
	if (action === "renameNoteFile") return validateNoteFilename(props, value);
	return null;
}

function validateTypeName(props: ActionContentProps, name: string) {
	const duplicate = Object.keys(props.typeDefinitions ?? {}).some(
		(type) => type.toLocaleLowerCase() === name.toLocaleLowerCase(),
	);
	return duplicate ? mobileText("workspace.action.nameAlreadyExists") : null;
}

function validateFolderName(props: ActionContentProps, name: string) {
	const candidate = [props.folderPath, name]
		.filter(Boolean)
		.join("/")
		.toLocaleLowerCase();
	const duplicate = props.folderPaths?.some(
		(path) => path.toLocaleLowerCase() === candidate,
	);
	return duplicate ? mobileText("workspace.action.nameAlreadyExists") : null;
}

function validateNoteFilename(props: ActionContentProps, value: string) {
	const result = validateMobileRenameNoteFilePath({
		filenameStem: value,
		note: props.selectedNote,
		notes: props.notes,
	});
	if (result === "collision")
		return mobileText("workspace.action.nameAlreadyExists");
	return result !== "ok" && result !== "same"
		? mobileText("save.error.invalidPath")
		: null;
}
