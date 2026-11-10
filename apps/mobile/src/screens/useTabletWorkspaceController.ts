import { useCallback, useState } from "react";
import { useMobileSearchEvent } from "../analytics/useMobileDiscoveryEvents";
import type { MobileWorkspaceAction } from "../components/workspace/MobileWorkspaceActionSheet";
import { mobileNoteWithResolvedWidth } from "../workspace/mobileNoteWidth";
import { mobileDefaultNoteWidthFromVaultConfig } from "../workspace/mobileVaultConfig";
import type {
	MobileNote,
	MobileWorkspaceSnapshot,
} from "../workspace/mobileWorkspaceModel";
import type {
	ReadOnlyWorkspaceRepository,
	ReadOnlyWorkspaceRequest,
} from "../workspace/readOnlyWorkspaceRepository";
import { emptyReadOnlyForm } from "./tabletWorkspaceActionForms";
import { actionSheetWorkspaceActions } from "./tabletWorkspaceActionOpeners";
import type {
	ApplyWorkspaceEdit,
	SaveSelectedEdit,
	SetOpenAction,
	TabletWorkspaceNavigation,
	WorkspaceActionsContext,
} from "./tabletWorkspaceController.types";
import { editorWorkspaceActions } from "./tabletWorkspaceEditorActions";
import {
	noteIconWorkspaceActions,
	propertyWorkspaceActions,
	relationshipWorkspaceActions,
	retargetWorkspaceActions,
} from "./tabletWorkspaceFieldActions";
import { useWorkspaceEditPipeline } from "./tabletWorkspacePersistence";
import { openMobileActionSheetQaTarget } from "./tabletWorkspaceQaTargets";
import { selectedFolderCommandActions } from "./tabletWorkspaceSelectedFolderActions";
import { useTabletWorkspaceSelectionActions } from "./tabletWorkspaceSelectionActions";
import type {
	MobileActionSheetQaTarget,
	TabletReadOnlyForm,
} from "./tabletWorkspaceTypes";
import {
	createWorkspaceActions,
	selectedViewCommandActions,
} from "./tabletWorkspaceViewActions";
import { useMobileNoteRead } from "./useMobileNoteRead";
import { useWorkspaceBackRefreshNavigation } from "./workspaceBackRefresh";

type TabletWorkspaceControllerRequest = {
	repository: ReadOnlyWorkspaceRepository;
	repositoryRequest?: ReadOnlyWorkspaceRequest;
	snapshot: MobileWorkspaceSnapshot;
};

export function useTabletWorkspaceController(
	request: TabletWorkspaceControllerRequest,
) {
	const pipeline = useWorkspaceEditPipeline(request);
	const { workspaceSnapshot } = pipeline;
	const {
		openAction,
		readOnlyForm,
		resetForm,
		setOpenAction,
		updateReadOnlyForm,
	} = useTabletWorkspaceActionState();
	const [searchQuery, setSearchQuery] = useState("");
	const navigation = useWorkspaceBackRefreshNavigation(
		workspaceSnapshot,
		searchQuery,
		request.repositoryRequest?.source === "native"
			? pipeline.reloadWorkspaceSnapshot
			: undefined,
	);
	const { defaultNoteWidth, selectedNote } = resolvedControllerNote(
		workspaceSnapshot,
		navigation.selectedNote,
	);
	const workspaceActions = useTabletWorkspaceControllerActions({
		applyWorkspaceEdit: pipeline.applyWorkspaceEdit,
		navigation,
		openAction,
		readOnlyForm,
		repository: request.repository,
		repositoryRequest: request.repositoryRequest,
		resetForm,
		selectedNote,
		setOpenAction,
		updateReadOnlyForm,
		workspaceSnapshot,
	});
	const presentation = tabletControllerPresentation(
		workspaceActions,
		pipeline,
		defaultNoteWidth,
		searchQuery,
		setSearchQuery,
	);
	return combineWorkspaceControllerResult(
		workspaceActions.actions,
		navigation,
		presentation,
	);
}

function combineWorkspaceControllerResult<
	TActions extends object,
	TNavigation extends object,
	TPresentation extends object,
>(actions: TActions, navigation: TNavigation, presentation: TPresentation) {
	return { ...actions, ...navigation, ...presentation };
}

type TabletWorkspaceControllerActionsInput = Pick<
	TabletWorkspaceActionsInput,
	| "applyWorkspaceEdit"
	| "navigation"
	| "openAction"
	| "readOnlyForm"
	| "repository"
	| "repositoryRequest"
	| "selectedNote"
	| "setOpenAction"
	| "updateReadOnlyForm"
	| "workspaceSnapshot"
> & { resetForm: ReturnType<typeof useReadOnlyFormState>["resetForm"] };

function useTabletWorkspaceControllerActions(
	input: TabletWorkspaceControllerActionsInput,
) {
	const selectionActions = useTabletWorkspaceSelectionActions(input);
	return useTabletWorkspaceActions({ ...input, ...selectionActions });
}

function useTabletWorkspaceActionState() {
	const [openAction, setOpenAction] = useState<MobileWorkspaceAction | null>(
		null,
	);
	useMobileSearchEvent(openAction === "search");
	return { ...useReadOnlyFormState(), openAction, setOpenAction };
}

function tabletControllerPresentation(
	workspaceActions: ReturnType<typeof useTabletWorkspaceActions>,
	pipeline: ReturnType<typeof useWorkspaceEditPipeline>,
	defaultNoteWidth: Parameters<
		typeof controllerPresentation
	>[0]["defaultNoteWidth"],
	searchQuery: string,
	setSearchQuery: Parameters<
		typeof controllerPresentation
	>[0]["setSearchQuery"],
) {
	return controllerPresentation({
		context: workspaceActions.context,
		pipeline,
		defaultNoteWidth,
		selectedNoteRead: workspaceActions.selectedNoteRead,
		searchQuery,
		setSearchQuery,
		openActionSheetQaTarget: workspaceActions.openActionSheetQaTarget,
	});
}

type TabletWorkspaceActionsInput = {
	applyEdit: ApplyWorkspaceEdit;
	applyWorkspaceEdit: ReturnType<
		typeof useWorkspaceEditPipeline
	>["applyWorkspaceEdit"];
	closeAction: () => void;
	navigation: TabletWorkspaceNavigation;
	openAction: MobileWorkspaceAction | null;
	readOnlyForm: TabletReadOnlyForm;
	repository: ReadOnlyWorkspaceRepository;
	repositoryRequest?: ReadOnlyWorkspaceRequest;
	saveSelectedEdit: SaveSelectedEdit;
	selectedNote: MobileNote | null;
	setOpenAction: SetOpenAction;
	updateReadOnlyForm: WorkspaceActionsContext["updateReadOnlyForm"];
	workspaceSnapshot: MobileWorkspaceSnapshot;
};

function useTabletWorkspaceActions(input: TabletWorkspaceActionsInput) {
	const {
		applyWorkspaceEdit,
		repository,
		repositoryRequest,
		saveSelectedEdit,
		workspaceSnapshot,
	} = input;
	const context = tabletWorkspaceActionContext(input);
	const bundle = tabletWorkspaceActionBundle(context, saveSelectedEdit);
	const { actionSheetActions } = bundle;
	const { navigation } = input;
	const support = useTabletWorkspaceActionSupport({
		actionSheetActions,
		applyWorkspaceEdit,
		navigation,
		repository,
		repositoryRequest,
		workspaceSnapshot,
	});
	return { actions: bundle.actions, context, ...support };
}

function tabletWorkspaceActionContext(input: TabletWorkspaceActionsInput) {
	const {
		applyEdit,
		closeAction,
		navigation,
		openAction,
		readOnlyForm,
		repositoryRequest,
		selectedNote,
		setOpenAction,
		updateReadOnlyForm,
		workspaceSnapshot,
	} = input;
	const context = {
		applyEdit,
		closeAction,
		navigation,
		openAction,
		readOnlyForm,
		repositoryRequest,
		selectedNote,
		setOpenAction,
		updateReadOnlyForm,
		workspaceSnapshot,
	};
	return context;
}

function tabletWorkspaceActionBundle(
	context: WorkspaceActionsContext,
	saveSelectedEdit: SaveSelectedEdit,
) {
	const createActions = createWorkspaceActions(context);
	const fieldActions = controllerFieldActions(context, saveSelectedEdit);
	const selectedActions = controllerSelectedActions(context);
	const actionSheetActions = actionSheetWorkspaceActions({
		...context,
		onCreateNoteDirect: createActions.onCreateNote,
	});
	return {
		actions: {
			...actionSheetActions,
			...createActions,
			...selectedActions.editorActions,
			...fieldActions,
			...selectedActions.selectedFolderActions,
			...selectedActions.selectedViewActions,
		},
		actionSheetActions,
	};
}

function useTabletWorkspaceActionSupport({
	actionSheetActions,
	applyWorkspaceEdit,
	navigation,
	repository,
	repositoryRequest,
	workspaceSnapshot,
}: {
	actionSheetActions: ReturnType<typeof actionSheetWorkspaceActions>;
	applyWorkspaceEdit: ReturnType<
		typeof useWorkspaceEditPipeline
	>["applyWorkspaceEdit"];
	navigation: TabletWorkspaceNavigation;
	repository: ReadOnlyWorkspaceRepository;
	repositoryRequest?: ReadOnlyWorkspaceRequest;
	workspaceSnapshot: MobileWorkspaceSnapshot;
}) {
	return {
		openActionSheetQaTarget: useControllerQaTarget(
			actionSheetActions,
			workspaceSnapshot,
		),
		selectedNoteRead: useMobileNoteRead({
			applyEdit: applyWorkspaceEdit,
			note: navigation.selectedNote,
			repository,
			request: repositoryRequest,
		}),
	};
}

function useReadOnlyFormState() {
	const [readOnlyForm, setReadOnlyForm] =
		useState<TabletReadOnlyForm>(emptyReadOnlyForm);
	const updateReadOnlyForm = useCallback(
		<Key extends keyof TabletReadOnlyForm>(
			key: Key,
			value: TabletReadOnlyForm[Key],
		) => {
			setReadOnlyForm((current) => ({ ...current, [key]: value }));
		},
		[],
	);

	return {
		readOnlyForm,
		resetForm: useCallback(() => setReadOnlyForm(emptyReadOnlyForm), []),
		updateReadOnlyForm,
	};
}

type ControllerPresentationInput = {
	context: WorkspaceActionsContext;
	pipeline: ReturnType<typeof useWorkspaceEditPipeline>;
	defaultNoteWidth: ReturnType<typeof mobileDefaultNoteWidthFromVaultConfig>;
	selectedNoteRead: ReturnType<typeof useMobileNoteRead>;
	searchQuery: string;
	setSearchQuery: (query: string) => void;
	openActionSheetQaTarget: (target: MobileActionSheetQaTarget) => void;
};

function controllerFieldActions(
	context: WorkspaceActionsContext,
	saveSelectedEdit: SaveSelectedEdit,
) {
	const {
		applyEdit,
		closeAction,
		readOnlyForm,
		selectedNote,
		setOpenAction,
		updateReadOnlyForm,
		workspaceSnapshot,
	} = context;
	const propertyActions = propertyWorkspaceActions({
		applyEdit,
		closeAction,
		readOnlyForm,
		saveSelectedEdit,
		setOpenAction,
		updateReadOnlyForm,
		workspaceSnapshot,
	});
	const relationshipActions = relationshipWorkspaceActions({
		applyEdit,
		closeAction,
		readOnlyForm,
		saveSelectedEdit,
		selectedNote,
		updateReadOnlyForm,
	});
	const retargetActions = retargetWorkspaceActions({
		readOnlyForm,
		saveSelectedEdit,
		selectedNote,
		updateReadOnlyForm,
	});
	const noteIconActions = noteIconWorkspaceActions({
		readOnlyForm,
		saveSelectedEdit,
		updateReadOnlyForm,
	});
	return {
		...noteIconActions,
		...propertyActions,
		...relationshipActions,
		...retargetActions,
	};
}

function controllerSelectedActions(context: WorkspaceActionsContext) {
	const {
		applyEdit,
		navigation,
		repositoryRequest,
		selectedNote,
		workspaceSnapshot,
	} = context;
	const editorActions = editorWorkspaceActions({
		applyEdit,
		repositoryRequest,
		selectedNote,
		workspaceSnapshot,
	});
	const selectedViewActions = selectedViewCommandActions({
		applyEdit,
		navigation,
		workspaceSnapshot,
	});
	const selectedFolderActions = selectedFolderCommandActions({
		applyEdit,
		sidebarSelection: navigation.sidebarSelection,
		vaultRootUri: repositoryRequest?.vaultRootUri ?? null,
	});
	return { editorActions, selectedFolderActions, selectedViewActions };
}

function controllerPresentation(input: ControllerPresentationInput) {
	return {
		...controllerWorkspacePresentation(input),
		...controllerNavigationPresentation(input),
	};
}

function controllerWorkspacePresentation({
	context,
	pipeline,
	defaultNoteWidth,
	selectedNoteRead,
	searchQuery,
}: ControllerPresentationInput) {
	return {
		openAction: context.openAction,
		readOnlyForm: context.readOnlyForm,
		searchQuery,
		defaultNoteWidth,
		snapshot: context.workspaceSnapshot,
		retryFailedEdit: pipeline.retryFailedEdit,
		failedWorkspaceAction: pipeline.failedWorkspaceAction,
		latestUndoFeedback: pipeline.latestUndoFeedback,
		selectedNote: context.selectedNote,
		selectedNoteRead,
		vaultRootUri: context.repositoryRequest?.vaultRootUri ?? null,
		canRedoWorkspaceEdit: pipeline.canRedoWorkspaceEdit,
		canUndoWorkspaceEdit: pipeline.canUndoWorkspaceEdit,
	};
}

function controllerNavigationPresentation({
	context,
	pipeline,
	setSearchQuery,
	openActionSheetQaTarget,
}: ControllerPresentationInput) {
	const { navigation } = context;
	const { redoWorkspaceEdit, reloadWorkspaceSnapshot, undoWorkspaceEdit } =
		pipeline;
	return {
		onEnterNeighborhood: navigation.selectNeighborhoodNote,
		onGoBack: navigation.goBack,
		onGoForward: navigation.goForward,
		onRedoWorkspaceEdit: redoWorkspaceEdit,
		onReloadVault: reloadWorkspaceSnapshot,
		onSelectFolder: navigation.selectFolder,
		onSelectNote: navigation.selectNote,
		onSelectSidebarItem: navigation.selectSidebarItem,
		onOpenActionSheetQaTarget: openActionSheetQaTarget,
		onSearchQueryChange: setSearchQuery,
		onUndoWorkspaceEdit: undoWorkspaceEdit,
	};
}

function useControllerQaTarget(
	actions: ReturnType<typeof actionSheetWorkspaceActions>,
	workspaceSnapshot: MobileWorkspaceSnapshot,
) {
	return useCallback(
		(target: MobileActionSheetQaTarget) => {
			openMobileActionSheetQaTarget(actions, target, workspaceSnapshot);
		},
		[actions, workspaceSnapshot],
	);
}

function resolvedControllerNote(
	snapshot: MobileWorkspaceSnapshot,
	note: MobileNote | null,
) {
	const defaultNoteWidth = mobileDefaultNoteWidthFromVaultConfig(
		snapshot.vaultConfig,
	);
	return {
		defaultNoteWidth,
		selectedNote: note
			? mobileNoteWithResolvedWidth(note, defaultNoteWidth)
			: null,
	};
}
