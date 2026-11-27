import { useCallback, useState } from "react";
import type { ViewDefinition } from "../types";
import { transitionWorkspacePanes } from "./transitionWorkspacePanes";

function useDialogVisibility() {
	const [visible, setVisible] = useState(false);
	const open = useCallback(() => setVisible(true), []);
	const close = useCallback(() => setVisible(false), []);
	return [visible, open, close] as const;
}

function useAiChatVisibility() {
	const [showAIChat, setShowAIChat] = useState(false);
	const openAIChat = useCallback(
		() => transitionWorkspacePanes("ai", () => setShowAIChat(true)),
		[],
	);
	const closeAIChat = useCallback(
		() => transitionWorkspacePanes("ai", () => setShowAIChat(false)),
		[],
	);
	const toggleAIChat = useCallback(
		() => transitionWorkspacePanes("ai", () => setShowAIChat((open) => !open)),
		[],
	);
	return { showAIChat, openAIChat, closeAIChat, toggleAIChat };
}

function useCreateViewVisibility() {
	const [showCreateViewDialog, setShowCreateViewDialog] = useState(false);
	const [editingView, setEditingView] = useState<{
		filename: string;
		definition: ViewDefinition;
		rootPath?: string;
	} | null>(null);
	const openCreateView = useCallback(() => {
		setEditingView(null);
		setShowCreateViewDialog(true);
	}, []);
	const closeCreateView = useCallback(() => {
		setShowCreateViewDialog(false);
		setEditingView(null);
	}, []);
	const openEditView = useCallback(
		(filename: string, definition: ViewDefinition, rootPath?: string) => {
			setEditingView({ filename, definition, rootPath });
			setShowCreateViewDialog(true);
		},
		[],
	);
	return {
		showCreateViewDialog,
		openCreateView,
		closeCreateView,
		editingView,
		openEditView,
	};
}

export function useDialogs() {
	const [showCreateTypeDialog, openCreateType, closeCreateType] =
		useDialogVisibility();
	const [showQuickOpen, openQuickOpen, closeQuickOpen] = useDialogVisibility();
	const [showCommandPalette, openCommandPalette, closeCommandPalette] =
		useDialogVisibility();
	const [showSettings, openSettings, closeSettings] = useDialogVisibility();
	const [showCloneVault, openCloneVault, closeCloneVault] =
		useDialogVisibility();
	const [showSearch, openSearch, closeSearch] = useDialogVisibility();
	const [showConflictResolver, openConflictResolver, closeConflictResolver] =
		useDialogVisibility();
	const aiChat = useAiChatVisibility();
	const view = useCreateViewVisibility();

	return {
		showCreateTypeDialog,
		openCreateType,
		closeCreateType,
		showQuickOpen,
		openQuickOpen,
		closeQuickOpen,
		showCommandPalette,
		openCommandPalette,
		closeCommandPalette,
		showSettings,
		openSettings,
		closeSettings,
		showCloneVault,
		openCloneVault,
		closeCloneVault,
		showSearch,
		openSearch,
		closeSearch,
		showConflictResolver,
		openConflictResolver,
		closeConflictResolver,
		...aiChat,
		...view,
	};
}
