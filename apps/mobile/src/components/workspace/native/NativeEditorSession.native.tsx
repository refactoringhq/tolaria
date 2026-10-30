import { type ComponentType, createElement } from "react";
import type {
	MobileWysiwygMarkdownEditorProps,
	NativeTentapEditorSurfaceProps,
} from "../MobileNativeEditor.types";
import { useNativeEditorAppearance } from "../useNativeEditorAppearance.native";
import type { NativeEditorRecoveryHandlers } from "../useNativeEditorRecovery";
import { useNativeEditorSurfaceSession } from "../useNativeEditorSurfaceSession";

type SurfaceProps = NativeTentapEditorSurfaceProps &
	NativeEditorRecoveryHandlers;
type SurfaceSessionProps = SurfaceProps & { appearance: { css: string } };
type NativeEditorSessionProps = MobileWysiwygMarkdownEditorProps &
	NativeEditorRecoveryHandlers & {
		EditorSurface: ComponentType<SurfaceSessionProps>;
	};
type NativeTentapEditorSurfacePropsWithComponent = SurfaceProps & {
	EditorSurface: ComponentType<SurfaceSessionProps>;
};

export function NativeEditorSession({
	EditorSurface,
	...props
}: NativeEditorSessionProps) {
	const session = useNativeEditorSurfaceSession(props);
	return createElement(NativeTentapEditorSurface, {
		...session,
		EditorSurface,
	});
}

function NativeTentapEditorSurface({
	EditorSurface,
	...props
}: NativeTentapEditorSurfacePropsWithComponent) {
	return createElement(EditorSurface, {
		...props,
		key: props.vaultRootUri ?? "",
		appearance: useNativeEditorAppearance(props),
	});
}
