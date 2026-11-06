import { ChromeSymbol } from "../components/ui/ChromeSymbol";
import { mobileText } from "../i18n/mobileText";
import { MobileIconButton } from "../ui/MobileIconButton";
import { useMobileColors, useMobileMetrics } from "../ui/theme/useMobileTheme";
import type { EditorToolbarProps } from "./TabletEditorPanel.types";

export function MobileEditorToolbarMarkdownSecondaryActions({
	onOpenMoreActions,
	onOpenTableOfContents,
}: Pick<EditorToolbarProps, "onOpenMoreActions" | "onOpenTableOfContents">) {
	const mobileColors = useMobileColors();
	const toolbarAction = useMobileMetrics().toolbarAction;
	return (
		<>
			{onOpenTableOfContents ? (
				<MobileIconButton
					accessibilityLabel={mobileText("editor.toolbar.openTableOfContents")}
					testID="editor-table-of-contents-action"
					onPress={onOpenTableOfContents}
				>
					<ChromeSymbol
						name="list"
						color={mobileColors.textMuted}
						size={toolbarAction.iconSize}
					/>
				</MobileIconButton>
			) : null}
			<MobileIconButton
				accessibilityLabel={mobileText("editor.toolbar.moreActions")}
				testID="editor-more-action"
				onPress={onOpenMoreActions}
			>
				<ChromeSymbol
					name="more"
					color={mobileColors.textMuted}
					size={toolbarAction.iconSize}
				/>
			</MobileIconButton>
		</>
	);
}
