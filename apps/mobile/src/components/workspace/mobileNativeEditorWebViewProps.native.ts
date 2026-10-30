import { probeProps } from "../../qa/mobileLayoutProbe";
import type {
	NativeEditorInputProps,
	NativeEditorStyle,
} from "./MobileWysiwygMarkdownEditor.native";

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
		onLoadEnd: props.injectEditorCss,
		onContentProcessDidTerminate: () =>
			props.onProcessLoss("contentProcessTerminated"),
		onRenderProcessGone: () => props.onProcessLoss("renderProcessGone"),
	};
}
