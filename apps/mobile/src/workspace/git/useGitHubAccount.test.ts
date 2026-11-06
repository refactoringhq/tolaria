import { expect, it, vi } from "vitest";
import { captureSignInOutcome } from "./useGitHubAccount";

it.each([
	[
		{ session: { token: "private" }, error: null },
		{ name: "mobile_github_sign_in_completed", outcome: "success" },
	],
	[
		{ session: null, error: null },
		{ name: "mobile_github_sign_in_completed", outcome: "cancelled" },
	],
	[
		{ session: null, error: "mobile.vaults.networkFailed" },
		{
			name: "mobile_github_sign_in_completed",
			outcome: "failed",
			failure_kind: "network",
		},
	],
	[
		{ session: null, error: "mobile.vaults.authFailed" },
		{
			name: "mobile_github_sign_in_completed",
			outcome: "failed",
			failure_kind: "denied",
		},
	],
	[
		{ session: null, error: "raw private server text" },
		{
			name: "mobile_github_sign_in_completed",
			outcome: "failed",
			failure_kind: "unknown",
		},
	],
])("maps sign-in state to a bounded outcome", (snapshot, expected) => {
	const capture = vi.fn();
	captureSignInOutcome(snapshot, capture);
	expect(capture).toHaveBeenCalledExactlyOnceWith(expected);
});
