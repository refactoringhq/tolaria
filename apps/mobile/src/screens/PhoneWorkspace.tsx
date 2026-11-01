import type { MobileWorkspaceSnapshot } from "../workspace/mobileWorkspaceModel";
import {
	fixtureReadOnlyWorkspaceRepository,
	type ReadOnlyWorkspaceRepository,
	type ReadOnlyWorkspaceRequest,
} from "../workspace/readOnlyWorkspaceRepository";
import type { MobileDeepLinkNavigationRequest } from "../workspace/useMobileIncomingDeepLink";
import { PhoneWorkspaceRoot } from "./PhoneWorkspaceLayout";
import { buildPhoneWorkspaceChromeRootProps } from "./phoneWorkspaceChromeRootProps";
import { phoneWorkspaceEditorOptions } from "./phoneWorkspaceEditorOptions";
import type {
	PhoneWorkspaceController,
	usePhoneWorkspaceNavigation,
} from "./phoneWorkspaceScreenSupport";
import type { PhoneWorkspaceState } from "./phoneWorkspaceTransitions";
import type { EditorEditingMode } from "./TabletEditorPanel";
import type { MobileActionSheetQaTarget } from "./tabletWorkspaceTypes";
import { useInitialActionSheetQaTarget } from "./useInitialActionSheetQaTarget";
import { usePhoneWorkspaceChromeController } from "./usePhoneWorkspaceChromeController";
import {
	usePhoneWorkspaceChromeCommands,
	usePhoneWorkspaceChromeNavigation,
	usePhoneWorkspaceChromePanels,
} from "./usePhoneWorkspaceChromeState";
import { useTabletWorkspaceController } from "./useTabletWorkspaceController";

export type { PhoneWorkspaceState } from "./phoneWorkspaceTransitions";

type PhoneWorkspaceProps = {
	initialCommandPaletteOpen?: boolean;
	initialEditorEditing?: boolean;
	initialEditorEditingMode?: EditorEditingMode;
	initialActionSheet?: MobileActionSheetQaTarget;
	commandPaletteProbe?: boolean;
	keyboardShortcutProbe?: boolean;
	initialState?: PhoneWorkspaceState;
	incomingNavigation?: MobileDeepLinkNavigationRequest | null;
	onIncomingNavigationHandled?: (requestId: number) => void;
	layoutProbe?: boolean;
	onOpenNativeVault?: () => void;
	repository?: ReadOnlyWorkspaceRepository;
	repositoryRequest?: ReadOnlyWorkspaceRequest;
	sourceIdleSave?: boolean;
	sourceSelectionProbe?: boolean;
	snapshot: MobileWorkspaceSnapshot;
	wysiwygAutocompleteProbe?: boolean;
	wysiwygExternalLinkProbe?: boolean;
	wysiwygFormatCommandProbe?: boolean;
	wysiwygInputTransformProbe?: boolean;
	wysiwygMarkdownBlockProbe?: boolean;
	wysiwygMathEditProbe?: boolean;
	wysiwygTableCommandMutationProbe?: boolean;
	wysiwygWikilinkInsertProbe?: boolean;
	wysiwygMutationProbe?: boolean;
};

type PhoneWorkspaceChromeProps = PhoneWorkspaceProps & {
	controller: PhoneWorkspaceController;
};

export function PhoneWorkspace(props: PhoneWorkspaceProps) {
	const {
		repository = fixtureReadOnlyWorkspaceRepository,
		repositoryRequest,
		snapshot,
	} = props;
	const controller = useTabletWorkspaceController({
		repository,
		repositoryRequest,
		snapshot,
	});
	const onOpenCreateNote =
		controller.snapshot.sync.kind === "noVault" ||
		controller.snapshot.sync.kind === "readOnly"
			? (props.onOpenNativeVault ?? controller.onOpenCreateNote)
			: controller.onOpenCreateNote;
	useInitialActionSheetQaTarget(
		controller.onOpenActionSheetQaTarget,
		props.initialActionSheet,
	);
	return (
		<PhoneWorkspaceChrome
			{...props}
			controller={{ ...controller, onOpenCreateNote }}
		/>
	);
}

function PhoneWorkspaceChrome(props: PhoneWorkspaceChromeProps) {
	const {
		commandPaletteProbe = false,
		controller: baseController,
		initialState = "list",
		keyboardShortcutProbe = false,
		onOpenNativeVault,
	} = props;
	const options = phoneWorkspaceEditorOptions(props);
	const { controller, phoneState, setPhoneState } =
		usePhoneWorkspaceChromeController({ baseController, initialState });
	const navigationState = usePhoneWorkspaceChromeNavigation({
		controller,
		layoutProbe: options.layoutProbe,
		phoneState,
		props,
		setPhoneState,
	});
	const commandState = usePhoneWorkspaceChromeCommands({
		commandPaletteProbe,
		controller,
		initialCommandPaletteOpen: props.initialCommandPaletteOpen,
		keyboardShortcutProbe,
		navigation: navigationState.navigation,
		onOpenNativeVault,
		phoneState,
		selectNextNote: navigationState.selectNextNote,
		selectPreviousNote: navigationState.selectPreviousNote,
	});
	const panelState = usePhoneWorkspaceChromePanels({
		controller,
		layoutProbe: options.layoutProbe,
		navigation: navigationState.navigation,
		phoneState,
		setPhoneState,
	});
	const rootProps = buildPhoneWorkspaceChromeRootProps({
		commandState,
		controller,
		navigationState,
		onOpenNativeVault,
		options,
		panelState,
		phoneState,
	});
	return <PhoneWorkspaceRoot {...rootProps} />;
}

export type PhoneWorkspaceNavigation = ReturnType<
	typeof usePhoneWorkspaceNavigation
>;
