import { expect, it, vi } from "vitest";
import { createWorkspaceBackAction } from "./workspaceBackRefresh";

it("refreshes the native workspace when back navigation returns to the list", () => {
	const goBack = vi.fn();
	const refresh = vi.fn();
	const action = createWorkspaceBackAction(goBack, () => true, refresh);

	action();

	expect(goBack).toHaveBeenCalledOnce();
	expect(refresh).toHaveBeenCalledOnce();
});

it("does not refresh when there is no back entry", () => {
	const goBack = vi.fn();
	const refresh = vi.fn();
	const action = createWorkspaceBackAction(goBack, () => false, refresh);

	action();

	expect(goBack).toHaveBeenCalledOnce();
	expect(refresh).not.toHaveBeenCalled();
});
