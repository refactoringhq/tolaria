import { useState } from "react";
import { useMobileLayoutProbe } from "../qa/mobileLayoutProbe";
import { logNativeMobileKeyboardShortcutActionProof } from "../qa/nativeMobileKeyboardShortcutProof";
import {
	useMobileEditorCommandRegistry,
	useMobileEditorOverlayFocus,
} from "../workspace/mobileEditorCommands";
import { useMobileWorkspaceKeyboardShortcuts } from "../workspace/mobileWorkspaceKeyboardShortcuts";
import { useIncomingDeepLinkNavigation } from "../workspace/useIncomingDeepLinkNavigation";
import type { MobileDeepLinkNavigationRequest } from "../workspace/useMobileIncomingDeepLink";
import {
	useCreateRelationshipTargetAndOpenEditor,
	usePhoneKeyboardShortcutBridgeProof,
	usePhoneWorkspaceNoteSelection,
} from "./phoneWorkspaceNavigationHelpers";
import {
	type PhoneWorkspaceController,
	usePhoneWorkspaceNavigation,
} from "./phoneWorkspaceScreenSupport";
import type { PhoneWorkspaceState } from "./phoneWorkspaceTransitions";
import { usePhoneCommandPalette } from "./usePhoneCommandPalette";
import { usePhoneCommandPaletteProof } from "./usePhoneCommandPaletteProof";
import { usePhonePanelRail } from "./usePhonePanelRail";
import { usePhoneSwipeHandlers } from "./usePhoneSwipeHandlers";
import { usePhoneTableOfContentsTarget } from "./usePhoneTableOfContentsTarget";
import { usePhoneViewportWidth } from "./usePhoneViewportWidth";

type IncomingNavigationProps = {
	incomingNavigation?: MobileDeepLinkNavigationRequest | null;
	onIncomingNavigationHandled?: (requestId: number) => void;
};

type NavigationStateProps = {
	controller: PhoneWorkspaceController;
	layoutProbe: boolean;
	phoneState: PhoneWorkspaceState;
	props: IncomingNavigationProps;
	setPhoneState: (state: PhoneWorkspaceState) => void;
};

type CommandStateProps = {
	commandPaletteProbe: boolean;
	controller: PhoneWorkspaceController;
	initialCommandPaletteOpen?: boolean;
	keyboardShortcutProbe: boolean;
	navigation: ReturnType<typeof usePhoneWorkspaceNavigation>;
	onOpenNativeVault?: () => void;
	phoneState: PhoneWorkspaceState;
	selectNextNote: () => void;
	selectPreviousNote: () => void;
};

type PanelStateProps = {
	controller: PhoneWorkspaceController;
	layoutProbe: boolean;
	navigation: ReturnType<typeof usePhoneWorkspaceNavigation>;
	phoneState: PhoneWorkspaceState;
	setPhoneState: (state: PhoneWorkspaceState) => void;
};

type ChromeAuxiliaryStateInput = {
	controller: PhoneWorkspaceController;
	layoutProbe: boolean;
	navigationState: ReturnType<typeof usePhoneWorkspaceChromeNavigation>;
	onOpenNativeVault?: () => void;
	phoneState: PhoneWorkspaceState;
	props: Pick<CommandStateProps, "initialCommandPaletteOpen"> & {
		commandPaletteProbe?: boolean;
		keyboardShortcutProbe?: boolean;
	};
	setPhoneState: (state: PhoneWorkspaceState) => void;
};

export function usePhoneWorkspaceChromeNavigation({
	controller,
	layoutProbe,
	phoneState,
	props,
	setPhoneState,
}: NavigationStateProps) {
	const [sourceModeRequest, setSourceModeRequest] = useState(0);
	const width = usePhoneViewportWidth();
	const panelRail = usePhonePanelRail(
		phoneState,
		width,
		setPhoneState,
		layoutProbe,
	);
	const navigation = usePhoneWorkspaceNavigation({
		controller,
		setPhoneState,
		setSourceModeRequest,
	});
	useIncomingDeepLinkNavigation(
		props.incomingNavigation,
		navigation.openEditor,
		props.onIncomingNavigationHandled,
	);
	const { selectNextNote, selectPreviousNote } =
		usePhoneWorkspaceNoteSelection(controller);
	return {
		navigation,
		panelRail,
		selectNextNote,
		selectPreviousNote,
		sourceModeRequest,
	};
}

export function usePhoneWorkspaceChromeCommands(props: CommandStateProps) {
	const {
		commandPaletteProbe,
		controller,
		initialCommandPaletteOpen,
		keyboardShortcutProbe,
		navigation,
		onOpenNativeVault,
		phoneState,
		selectNextNote,
		selectPreviousNote,
	} = props;
	const editorCommandRegistry = useMobileEditorCommandRegistry();
	const commandPalette = usePhoneCommandPalette({
		controller,
		initialOpen: initialCommandPaletteOpen,
		onOpenNativeVault,
		onPastePlainText: editorCommandRegistry.commands.pastePlainText,
		onSaveActiveEditor: editorCommandRegistry.commands.save,
		onToggleRawEditor: editorCommandRegistry.commands.toggleRawEditor,
		openEditor: navigation.openEditor,
		openList: navigation.openList,
		openNeighborhoodList: navigation.openNeighborhoodList,
		openProperties: navigation.openProperties,
		openSidebar: navigation.openSidebar,
		phoneState,
	});
	usePhoneWorkspaceKeyboardCommands({
		commandPalette,
		commandPaletteProbe,
		controller,
		editorCommandRegistry,
		keyboardShortcutProbe,
		phoneState,
		selectNextNote,
		selectPreviousNote,
	});
	return { commandPalette, editorCommandRegistry };
}

type KeyboardCommandsProps = Pick<
	CommandStateProps,
	| "commandPaletteProbe"
	| "controller"
	| "keyboardShortcutProbe"
	| "phoneState"
	| "selectNextNote"
	| "selectPreviousNote"
> & {
	commandPalette: ReturnType<typeof usePhoneCommandPalette>;
	editorCommandRegistry: ReturnType<typeof useMobileEditorCommandRegistry>;
};

function usePhoneWorkspaceKeyboardCommands(props: KeyboardCommandsProps) {
	const {
		commandPalette,
		commandPaletteProbe,
		controller,
		editorCommandRegistry,
		keyboardShortcutProbe,
		phoneState,
		selectNextNote,
		selectPreviousNote,
	} = props;
	useMobileEditorOverlayFocus(
		phoneState !== "editor" ||
			Boolean(controller.openAction) ||
			commandPalette.visible,
		editorCommandRegistry.commands,
	);
	useMobileWorkspaceKeyboardShortcuts({
		nativeNoteNavigationEnabled:
			phoneState === "list" &&
			!commandPalette.visible &&
			!controller.openAction,
		onCreateNote: controller.onOpenCreateNote,
		onOpenFindInNote: controller.onOpenFindInNote,
		onOpenCommandPalette: commandPalette.open,
		onOpenSearch: controller.onOpenSearch,
		onSelectNextNote: selectNextNote,
		onSelectPreviousNote: selectPreviousNote,
		onShortcutAction: keyboardShortcutProbe
			? logNativeMobileKeyboardShortcutActionProof
			: undefined,
		onToggleRawEditor: editorCommandRegistry.commands.toggleRawEditor,
	});
	usePhoneCommandPaletteProof(commandPalette.commands, commandPaletteProbe);
	usePhoneKeyboardShortcutBridgeProof(keyboardShortcutProbe);
}

export function usePhoneWorkspaceChromePanels({
	controller,
	layoutProbe,
	navigation,
	phoneState,
	setPhoneState,
}: PanelStateProps) {
	const tableOfContents = usePhoneTableOfContentsTarget(setPhoneState);
	const phoneLayoutProbe = useMobileLayoutProbe(layoutProbe);
	const createRelationshipTargetAndOpenEditor =
		useCreateRelationshipTargetAndOpenEditor(controller, setPhoneState);
	const transitionSwipeHandlers = usePhoneSwipeHandlers({
		openEditor: navigation.openEditor,
		openList: navigation.openList,
		openProperties: navigation.openProperties,
		openSidebar: navigation.openSidebar,
		phoneState,
	});
	const suggestionNotes =
		controller.snapshot.allNotes ?? controller.snapshot.notes;
	return {
		createRelationshipTargetAndOpenEditor,
		phoneLayoutProbe,
		suggestionNotes,
		tableOfContents,
		transitionSwipeHandlers,
	};
}

export function usePhoneWorkspaceChromeAuxiliaryState({
	controller,
	layoutProbe,
	navigationState,
	onOpenNativeVault,
	phoneState,
	props,
	setPhoneState,
}: ChromeAuxiliaryStateInput) {
	const commandState = usePhoneWorkspaceChromeCommands({
		commandPaletteProbe: props.commandPaletteProbe ?? false,
		controller,
		initialCommandPaletteOpen: props.initialCommandPaletteOpen,
		keyboardShortcutProbe: props.keyboardShortcutProbe ?? false,
		navigation: navigationState.navigation,
		onOpenNativeVault,
		phoneState,
		selectNextNote: navigationState.selectNextNote,
		selectPreviousNote: navigationState.selectPreviousNote,
	});
	const panelState = usePhoneWorkspaceChromePanels({
		controller,
		layoutProbe,
		navigation: navigationState.navigation,
		phoneState,
		setPhoneState,
	});
	return { commandState, panelState };
}
