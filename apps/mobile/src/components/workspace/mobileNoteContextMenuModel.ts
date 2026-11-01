import type { MenuAction } from "@expo/ui/community/menu";
import { mobileText } from "../../i18n/mobileText";

export function mobileNoteContextActions({
	archived,
	favorite,
	selectionEnabled,
}: {
	archived: boolean;
	favorite: boolean;
	selectionEnabled: boolean;
}): MenuAction[] {
	const actions = [
		favoriteAction(favorite),
		archiveAction(archived),
		moveAction(),
		deleteAction(),
	];
	return selectionEnabled ? [...actions, selectAction()] : actions;
}

export function runMobileNoteContextAction(
	action: string,
	callbacks: {
		actions?: {
			onArchive: (noteIds: string[], archived: boolean) => void;
			onDelete: (noteIds: string[]) => void;
			onOrganize?: (noteIds: string[]) => void;
			onToggleFavorite: (noteId: string) => void;
		};
		archived: boolean;
		onBeginSelection?: (noteId: string) => void;
		noteId: string;
	},
): void {
	const noteIds = [callbacks.noteId];
	switch (action) {
		case "archive":
			callbacks.actions?.onArchive(noteIds, !callbacks.archived);
			break;
		case "delete":
			callbacks.actions?.onDelete(noteIds);
			break;
		case "favorite":
			callbacks.actions?.onToggleFavorite(callbacks.noteId);
			break;
		case "move":
			callbacks.actions?.onOrganize?.(noteIds);
			break;
		case "select":
			callbacks.onBeginSelection?.(callbacks.noteId);
			break;
	}
}

function favoriteAction(favorite: boolean): MenuAction {
	const key = favorite
		? "command.note.removeFavorite"
		: "command.note.addFavorite";
	return {
		id: "favorite",
		title: mobileText(key),
		image: "star",
		state: favorite ? "on" : "off",
	};
}

function archiveAction(archived: boolean): MenuAction {
	const key = archived
		? "command.note.unarchiveNote"
		: "command.note.archiveNote";
	return { id: "archive", title: mobileText(key), image: "archivebox" };
}

function moveAction(): MenuAction {
	return {
		id: "move",
		title: mobileText("command.note.moveToFolder"),
		image: "folder",
	};
}

function deleteAction(): MenuAction {
	return {
		id: "delete",
		title: mobileText("command.note.deleteNote"),
		image: "trash",
		attributes: { destructive: true },
	};
}

function selectAction(): MenuAction {
	return {
		id: "select",
		title: mobileText("command.footerSelect").replace(/^↵\s*/, ""),
	};
}
