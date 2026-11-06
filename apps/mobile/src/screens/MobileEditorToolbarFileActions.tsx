import { ChromeSymbol } from "../components/ui/ChromeSymbol";
import { mobileText } from "../i18n/mobileText";
import { MobileIconButton } from "../ui/MobileIconButton";
import { useMobileColors, useMobileMetrics } from "../ui/theme/useMobileTheme";
import type { EditorToolbarProps } from "./TabletEditorPanel.types";

export function MobileEditorToolbarFileActions(props: EditorToolbarProps) {
	const mobileColors = useMobileColors();
	const toolbarAction = useMobileMetrics().toolbarAction;
	return (
		<MobileIconButton
			accessibilityLabel={mobileText("editor.toolbar.moreActions")}
			testID="editor-more-action"
			onPress={props.onOpenMoreActions}
		>
			<ChromeSymbol
				name="more"
				color={mobileColors.textMuted}
				size={toolbarAction.iconSize}
			/>
		</MobileIconButton>
	);
}
