import type { ComponentProps } from "react";
import type { PhoneWorkspaceRoot } from "./PhoneWorkspaceLayout";
import type { PhoneWorkspaceEditorOptions } from "./phoneWorkspaceEditorOptions";
import type { PhoneWorkspaceController } from "./phoneWorkspaceScreenSupport";
import type { PhoneWorkspaceState } from "./phoneWorkspaceTransitions";
import type {
	usePhoneWorkspaceChromeCommands,
	usePhoneWorkspaceChromeNavigation,
	usePhoneWorkspaceChromePanels,
} from "./usePhoneWorkspaceChromeState";

type RootPropsInput = {
	commandState: ReturnType<typeof usePhoneWorkspaceChromeCommands>;
	controller: PhoneWorkspaceController;
	navigationState: ReturnType<typeof usePhoneWorkspaceChromeNavigation>;
	onOpenNativeVault?: () => void;
	options: PhoneWorkspaceEditorOptions;
	onEditorBodyReady: () => void;
	panelState: ReturnType<typeof usePhoneWorkspaceChromePanels>;
	phoneState: PhoneWorkspaceState;
	prepareNewNoteEditor: boolean;
};

export function buildPhoneWorkspaceChromeRootProps(
	input: RootPropsInput,
): ComponentProps<typeof PhoneWorkspaceRoot> {
	return {
		commandPaletteElement: input.commandState.commandPalette.element,
		controller: input.controller,
		createRelationshipTargetAndOpenEditor:
			input.panelState.createRelationshipTargetAndOpenEditor,
		panelRail: input.navigationState.panelRail,
		editorCommandRegistry: input.commandState.editorCommandRegistry,
		navigation: input.navigationState.navigation,
		openCommandPalette: input.commandState.commandPalette.open,
		options: input.options,
		onEditorBodyReady: input.onEditorBodyReady,
		phoneLayoutProbe: input.panelState.phoneLayoutProbe.probe,
		phoneState: input.phoneState,
		prepareNewNoteEditor: input.prepareNewNoteEditor,
		selectTableOfContentsTarget: input.panelState.tableOfContents.select,
		sourceModeRequest: input.navigationState.sourceModeRequest,
		suggestionNotes: input.panelState.suggestionNotes,
		tableOfContentsTarget: input.panelState.tableOfContents.target,
		transitionSwipeHandlers: input.panelState.transitionSwipeHandlers,
		onOpenNativeVault: input.onOpenNativeVault,
	};
}
