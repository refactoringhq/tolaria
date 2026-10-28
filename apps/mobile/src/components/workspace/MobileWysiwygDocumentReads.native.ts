import {
	BridgeExtension,
	CoreBridge,
	CoreEditorActionType,
	type EditorBridge,
	type TenTapStartKit,
} from "@10play/tentap-editor";
import { MobileWysiwygHorizontalRuleBridge } from "./MobileWysiwygHorizontalRuleBridge.native";
import {
	createMobileEditorDocumentRequests,
	type MobileEditorDocumentReadMessage,
} from "./mobileEditorDocumentRequests";

type SendCoreMessage = Parameters<
	NonNullable<typeof CoreBridge.extendEditorInstance>
>[0];
export function isJsonReadableEditorBridge(
	editor: EditorBridge | null,
): editor is EditorBridge & { getJSON: () => Promise<unknown> } {
	return typeof editor?.getJSON === "function";
}

/** Override only native read callbacks; the bundled CoreBridge wire format is unchanged. */
export function createMobileEditorDocumentBridge(
	extensions: typeof TenTapStartKit,
) {
	const requests = createMobileEditorDocumentRequests();
	let ready = false;
	const extendCore = CoreBridge.extendEditorInstance;
	if (!extendCore) throw new Error("editorCoreBridgeUnavailable");
	const bridge = new BridgeExtension({
		...CoreBridge,
		forceName: CoreBridge.name,
		extendEditorInstance: (...args: Parameters<typeof extendCore>) => ({
			...extendCore(...args),
			getJSON: () =>
				requests.readJSON((message) => sendCoreRead(args[0], message)),
			getHTML: () =>
				requests.readHTML((message) => sendCoreRead(args[0], message)),
			getText: () =>
				requests.readText((message) => sendCoreRead(args[0], message)),
		}),
		onEditorMessage: (message, editor) => {
			if (message.type === CoreEditorActionType.EditorReady) ready = true;
			return (
				requests.receive(message) ||
				(CoreBridge.onEditorMessage?.(message, editor) ?? false)
			);
		},
	});
	return {
		extensions: [...extensions, MobileWysiwygHorizontalRuleBridge, bridge],
		requests,
		isReady: () => ready,
	};
}

function sendCoreRead(
	send: SendCoreMessage,
	{ type, payload }: MobileEditorDocumentReadMessage,
) {
	switch (type) {
		case "get-json":
			send({ type: CoreEditorActionType.GetJSON, payload });
			return;
		case "get-html":
			send({ type: CoreEditorActionType.GetHTML, payload });
			return;
		case "get-text":
			send({ type: CoreEditorActionType.GetText, payload });
			return;
	}
}
