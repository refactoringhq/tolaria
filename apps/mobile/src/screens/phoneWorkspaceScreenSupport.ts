import { type Dispatch, type SetStateAction, useCallback } from "react";
import { useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { MobileLayoutProbe } from "../qa/mobileLayoutProbe";
import type { RegisterMobileEditorCommands } from "../workspace/mobileEditorCommands";
import type { MobileTableOfContentsTarget } from "../workspace/mobileTableOfContents";
import type { MobileNote } from "../workspace/mobileWorkspaceModel";
import { phonePanelDragSurface } from "./phonePanelDragSurface";
import type { PhoneWorkspaceEditorOptions } from "./phoneWorkspaceEditorOptions";
import type { PhoneWorkspaceState } from "./phoneWorkspaceTransitions";
import type { usePhonePanelRail } from "./usePhonePanelRail";
import type { useTabletWorkspaceController } from "./useTabletWorkspaceController";

export type PhoneTableOfContentsTargetRequest = MobileTableOfContentsTarget & {
	requestId: number;
};

export function usePhonePanelDragSurface(state: PhoneWorkspaceState) {
	const { width } = useWindowDimensions();
	const { top, left, right } = useSafeAreaInsets();
	return useCallback(
		(start: { x: number; y: number }) =>
			phonePanelDragSurface(
				state,
				{ x: start.x - left, y: start.y },
				width - left - right,
				top,
			),
		[state, width, top, left, right],
	);
}

export type PhoneWorkspaceController = ReturnType<
	typeof useTabletWorkspaceController
>;
export type PhonePanelRail = ReturnType<typeof usePhonePanelRail>;

type NavigationOptions = {
	controller: PhoneWorkspaceController;
	setPhoneState: (state: PhoneWorkspaceState) => void;
	setSourceModeRequest: Dispatch<SetStateAction<number>>;
};

export function usePhoneWorkspaceNavigation({
	controller,
	setPhoneState,
	setSourceModeRequest,
}: NavigationOptions) {
	const openList = useCallback(() => setPhoneState("list"), [setPhoneState]);
	const openSidebar = useCallback(
		() => setPhoneState("sidebar"),
		[setPhoneState],
	);
	const openProperties = useCallback(
		() => setPhoneState("properties"),
		[setPhoneState],
	);
	const openEditor = useCallback(
		(noteId?: string) => {
			if (noteId) controller.onSelectNote(noteId);
			setPhoneState("editor");
		},
		[controller, setPhoneState],
	);
	const openSourceEditor = useCallback(() => {
		setSourceModeRequest((current) => current + 1);
		setPhoneState("editor");
	}, [setPhoneState, setSourceModeRequest]);
	const openNeighborhoodList = useCallback(
		(noteId: string) => {
			controller.onEnterNeighborhood(noteId);
			setPhoneState("list");
		},
		[controller, setPhoneState],
	);
	return {
		openEditor,
		openList,
		openNeighborhoodList,
		openProperties,
		openSidebar,
		openSourceEditor,
	};
}

export type PhoneWorkspaceStateViewProps = {
	controller: PhoneWorkspaceController;
	options: PhoneWorkspaceEditorOptions;
	openEditor: (noteId?: string) => void;
	openSourceEditor: () => void;
	openCommandPalette: () => void;
	openList: () => void;
	openProperties: () => void;
	openSidebar: () => void;
	phoneLayoutProbe: MobileLayoutProbe;
	phoneState: PhoneWorkspaceState;
	prepareNewNoteEditor?: boolean;
	onEditorBodyReady?: () => void;
	onRegisterEditorCommands?: RegisterMobileEditorCommands;
	sourceModeRequest: number;
	suggestionNotes: MobileNote[];
	tableOfContentsTarget: PhoneTableOfContentsTargetRequest | null;
};
