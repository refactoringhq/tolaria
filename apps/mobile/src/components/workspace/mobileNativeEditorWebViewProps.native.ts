import { probeProps } from "../../qa/mobileLayoutProbe";
import type {
	NativeEditorInputProps,
	NativeEditorStyle,
} from "./MobileWysiwygMarkdownEditor.native";
import { mobileEditorLinkInteractionScript } from "./mobileEditorLinkInteraction.native";

export function createNativeEditorWebViewProps(
	props: NativeEditorInputProps,
	style: NativeEditorStyle,
) {
	return {
		editor: props.editor,
		...props.fileSource.webViewProps,
		...probeProps(props.layoutProbe, "editor.wysiwyg.richText"),
		style,
		testID: "editor-wysiwyg-input",
		onLoadEnd: () => {
			props.injectEditorCss();
			props.editor.webviewRef.current?.injectJavaScript(
				mobileEditorLinkInteractionScript,
			);
		},
		onContentProcessDidTerminate: () =>
			props.onProcessLoss("contentProcessTerminated"),
		onRenderProcessGone: () => props.onProcessLoss("renderProcessGone"),
	};
}
