import { useMemo } from "react";
import {
	useMobileColors,
	useMobileMetrics,
} from "../../ui/theme/useMobileTheme";
import type { NativeTentapEditorSurfaceProps } from "./MobileNativeEditor.types";
import { mobileTentapEditorCss } from "./MobileWysiwygMarkdownEditorCss";

type AppearanceProps = Pick<
	NativeTentapEditorSurfaceProps,
	"compact" | "sourceNote"
>;

export function useNativeEditorAppearance(props: AppearanceProps) {
	const colors = useMobileColors();
	const metrics = useMobileMetrics();
	return useMemo(
		() => ({
			css: mobileTentapEditorCss(
				props.compact,
				props.sourceNote.noteWidth,
				colors,
				metrics,
			),
		}),
		[colors, metrics, props.compact, props.sourceNote.noteWidth],
	);
}
