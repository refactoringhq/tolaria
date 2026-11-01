import { useCallback, useMemo, useState } from "react";
import type { PhoneWorkspaceController } from "./phoneWorkspaceScreenSupport";
import type { PhoneWorkspaceState } from "./phoneWorkspaceTransitions";

type ChromeControllerProps = {
	baseController: PhoneWorkspaceController;
	initialState: PhoneWorkspaceState;
};

export function usePhoneWorkspaceChromeController({
	baseController,
	initialState,
}: ChromeControllerProps) {
	const [phoneState, updatePhoneState] = useState(initialState);
	const setPhoneState = useCallback(
		(state: PhoneWorkspaceState) => updatePhoneState(state),
		[],
	);
	const createAndOpenNote = useCallback(() => {
		baseController.onOpenCreateNote();
		if (
			baseController.snapshot.sync.kind !== "noVault" &&
			baseController.snapshot.sync.kind !== "readOnly"
		) {
			setPhoneState("editor");
		}
	}, [baseController, setPhoneState]);
	const controller = useMemo(
		() => ({ ...baseController, onOpenCreateNote: createAndOpenNote }),
		[baseController, createAndOpenNote],
	);
	return { controller, phoneState, setPhoneState };
}
