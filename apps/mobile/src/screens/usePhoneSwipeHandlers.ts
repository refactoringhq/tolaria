import { useHorizontalSwipe } from "../ui/useHorizontalSwipe";
import { usePhonePanelDragSurface } from "./phoneWorkspaceScreenSupport";
import type { PhoneWorkspaceState } from "./phoneWorkspaceTransitions";

type UsePhoneSwipeHandlersProps = {
	openEditor: (noteId?: string) => void;
	openList: () => void;
	openProperties: () => void;
	openSidebar: () => void;
	phoneState: PhoneWorkspaceState;
};

export function usePhoneSwipeHandlers({
	openEditor,
	openList,
	openProperties,
	openSidebar,
	phoneState,
}: UsePhoneSwipeHandlersProps) {
	const canStart = usePhonePanelDragSurface(phoneState);
	const actions = {
		editor: { onSwipeLeft: openProperties, onSwipeRight: openList },
		list: { onSwipeRight: openSidebar },
		properties: { onSwipeRight: openEditor },
		sidebar: { onSwipeLeft: openList },
	};
	return useHorizontalSwipe({ canStart, ...actions[phoneState] });
}
