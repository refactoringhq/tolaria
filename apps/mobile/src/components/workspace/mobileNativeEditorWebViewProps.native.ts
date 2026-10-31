import type { RichText } from "@10play/tentap-editor";
import type { ComponentProps } from "react";
import { probeProps } from "../../qa/mobileLayoutProbe";
import type {
	NativeEditorInputProps,
	NativeEditorStyle,
} from "./MobileWysiwygMarkdownEditor.native";
import { shouldShowPhoneEditorTitle } from "./mobileEditorTitleVisibility";

type EditorScrollEvent = Parameters<NonNullable<ComponentProps<typeof RichText>["onScroll"]>>[0];

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
		onScroll: (event: EditorScrollEvent) => props.onTitleVisibilityChange?.(shouldShowPhoneEditorTitle(event.nativeEvent.contentOffset.y)),
		onContentProcessDidTerminate: () =>
			props.onProcessLoss("contentProcessTerminated"),
		onRenderProcessGone: () => props.onProcessLoss("renderProcessGone"),
	};
}
