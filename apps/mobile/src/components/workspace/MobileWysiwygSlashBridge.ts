import { type AnyExtension, type Editor, Extension } from "@tiptap/core";
import type {
	MobileSlashAction,
	MobileSlashState,
} from "./MobileWysiwygSlashCommands";

type SlashMessage = {
	type: "mobile-slash-command";
	payload: MobileSlashAction;
};
type SlashRuntime = {
	extension: AnyExtension;
	read: (editor: Editor) => MobileSlashState | null;
	run: (editor: Editor, action: MobileSlashAction) => boolean;
};

export type MobileSlashEditorBridge = {
	runMobileSlash: (action: MobileSlashAction) => void;
};

// The native half declares the bridge; ProseMirror plugins live only in the WebView.
const nativeRuntime: SlashRuntime = {
	extension: Extension.create({ name: "mobileSlash" }),
	read: () => null,
	run: () => false,
};

export function createMobileSlashBridge(runtime = nativeRuntime) {
	return {
		name: "mobileSlash",
		tiptapExtension: runtime.extension,
		clone: () => createMobileSlashBridge(runtime),
		configureCSS: () => createMobileSlashBridge(runtime),
		configureExtension: () => createMobileSlashBridge(runtime),
		extendExtension: () => createMobileSlashBridge(runtime),
		configureTiptapExtensionsOnRunTime: () => [runtime.extension],
		extendCSS: "",
		extendEditorState: (editor: Editor) => ({
			mobileSlash: runtime.read(editor),
		}),
		extendEditorInstance: (
			send: (message: SlashMessage) => void,
		): MobileSlashEditorBridge => ({
			runMobileSlash: (action) =>
				send({ type: "mobile-slash-command", payload: action }),
		}),
		onBridgeMessage: (editor: Editor, message: SlashMessage) => {
			if (message.type !== "mobile-slash-command") return false;
			return runtime.run(editor, message.payload);
		},
	};
}

export const MobileWysiwygSlashBridge = createMobileSlashBridge();
