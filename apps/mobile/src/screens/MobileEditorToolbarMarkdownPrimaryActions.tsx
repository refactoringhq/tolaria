import { ChromeSymbol } from "../components/ui/ChromeSymbol";
import { mobileText } from "../i18n/mobileText";
import { MobileIconButton } from "../ui/MobileIconButton";
import { useMobileColors, useMobileMetrics } from "../ui/theme/useMobileTheme";
import type { EditorToolbarProps } from "./TabletEditorPanel.types";

export function MobileEditorToolbarMarkdownPrimaryActions({
	note,
	onToggleFavorite,
	onToggleSourceMode,
	sourceModeActive,
}: Pick<
	EditorToolbarProps,
	"note" | "onToggleFavorite" | "onToggleSourceMode"
> & {
	sourceModeActive: boolean;
}) {
	const mobileColors = useMobileColors();
	const toolbarAction = useMobileMetrics().toolbarAction;
	return (
		<>
			<EditorFavoriteAction note={note} onToggleFavorite={onToggleFavorite} />
			<MobileIconButton
				accessibilityLabel={mobileText(
					sourceModeActive
						? "editor.toolbar.rawReturn"
						: "editor.toolbar.rawOpen",
				)}
				selected={sourceModeActive}
				testID="editor-source-action"
				onPress={onToggleSourceMode}
			>
				<ChromeSymbol
					name="code"
					color={
						sourceModeActive ? mobileColors.primary : mobileColors.textMuted
					}
					size={toolbarAction.iconSize}
				/>
			</MobileIconButton>
		</>
	);
}

function EditorFavoriteAction({
	note,
	onToggleFavorite,
}: Pick<EditorToolbarProps, "note" | "onToggleFavorite">) {
	const mobileColors = useMobileColors();
	const iconSize = useMobileMetrics().toolbarAction.iconSize;
	const active = note.favorite === true;
	return (
		<MobileIconButton
			accessibilityLabel={mobileText(
				active ? "command.note.removeFavorite" : "command.note.addFavorite",
			)}
			testID="editor-favorite-action"
			onPress={onToggleFavorite}
		>
			<ChromeSymbol
				name={active ? "starFilled" : "star"}
				color={active ? mobileColors.primary : mobileColors.textMuted}
				size={iconSize}
			/>
		</MobileIconButton>
	);
}
