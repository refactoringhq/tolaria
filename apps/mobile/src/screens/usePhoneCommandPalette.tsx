import { useCallback, useMemo, useState } from "react";
import { MobileCommandPalette } from "../components/workspace/MobileCommandPalette";
import { buildMobileCommandPaletteCommands } from "../workspace/mobileCommandPalette";
import type { PhoneWorkspaceController } from "./phoneWorkspaceScreenSupport";
import type { PhoneWorkspaceState } from "./phoneWorkspaceTransitions";

type UsePhoneCommandPaletteProps = {
	controller: PhoneWorkspaceController;
	initialOpen?: boolean;
	onOpenNativeVault?: () => void;
	onPastePlainText?: () => void;
	onSaveActiveEditor?: () => void;
	onToggleRawEditor?: () => void;
	openEditor: (noteId?: string) => void;
	openList: () => void;
	openNeighborhoodList: (noteId: string) => void;
	openProperties: () => void;
	openSidebar: () => void;
	phoneState: PhoneWorkspaceState;
};

export function usePhoneCommandPalette(props: UsePhoneCommandPaletteProps) {
	const { initialOpen = false, openEditor, openProperties, phoneState } = props;
	const [visible, setVisible] = useState(initialOpen);
	const open = useCallback(() => setVisible(true), []);
	const close = useCallback(() => setVisible(false), []);
	const toggleProperties = useCallback(() => {
		if (phoneState === "properties") openEditor();
		else openProperties();
	}, [openEditor, openProperties, phoneState]);
	const commands = usePhonePaletteCommands(props, open, toggleProperties);
	return {
		commands,
		element: visible ? (
			<MobileCommandPalette commands={commands} onClose={close} />
		) : null,
		open,
		visible,
	};
}

function usePhonePaletteCommands(
	props: UsePhoneCommandPaletteProps,
	open: () => void,
	toggleProperties: () => void,
) {
	const {
		controller,
		onOpenNativeVault,
		onPastePlainText,
		onSaveActiveEditor,
		onToggleRawEditor,
		openEditor,
		openList,
		openNeighborhoodList,
		openProperties,
		openSidebar,
	} = props;
	return useMemo(
		() =>
			buildMobileCommandPaletteCommands({
				...controller,
				onOpenCommandPalette: open,
				onOpenBacklinks: openProperties,
				onOpenNativeVault,
				onEnterNeighborhood: openNeighborhoodList,
				onPastePlainText,
				onSaveActiveEditor,
				onToggleRawEditor,
				onToggleProperties: toggleProperties,
				onViewAll: openSidebar,
				onViewEditorList: openList,
				onViewEditorOnly: openEditor,
			}),
		[
			controller,
			onOpenNativeVault,
			open,
			onPastePlainText,
			onSaveActiveEditor,
			onToggleRawEditor,
			openEditor,
			openList,
			openNeighborhoodList,
			openProperties,
			openSidebar,
			toggleProperties,
		],
	);
}
