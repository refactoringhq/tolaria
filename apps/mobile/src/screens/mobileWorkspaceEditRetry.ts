import { useCallback } from "react";
import type { MobileWorkspaceEdit } from "../workspace/mobileWorkspaceEditing";
import type { usePreparedWorkspaceEdits } from "./usePreparedWorkspaceEdits";

type RetryServices = {
	applyWorkspaceEdit: ReturnType<typeof usePreparedWorkspaceEdits>["apply"];
	clearFailedWrite: () => void;
	failedWrite: { edit: MobileWorkspaceEdit } | null;
	retryPreparedEdit?: () => void;
};

export function useWorkspaceEditRetry(services: RetryServices) {
	const {
		applyWorkspaceEdit,
		clearFailedWrite,
		failedWrite,
		retryPreparedEdit,
	} = services;
	return useCallback(() => {
		if (failedWrite) {
			clearFailedWrite();
			void applyWorkspaceEdit(failedWrite.edit, { recordHistory: false });
			return;
		}
		retryPreparedEdit?.();
	}, [applyWorkspaceEdit, clearFailedWrite, failedWrite, retryPreparedEdit]);
}
