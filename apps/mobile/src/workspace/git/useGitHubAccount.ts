import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import type { MobileAnalyticsEvent } from "../../analytics/mobileAnalytics";
import { useMobileAnalytics } from "../../analytics/useMobileAnalytics";
import { createGitHubAccountState } from "./githubAccountState";
import {
	beginGitHubSignIn,
	finishGitHubSignIn,
	listGitHubRepositories,
	refreshGitHubSession,
} from "./githubAuth";
import { resolveGitHubClientId } from "./githubClientId";
import {
	clearGitHubSession,
	readGitHubSession,
	saveGitHubSession,
} from "./githubSessionStore";

const clientId = resolveGitHubClientId(
	process.env.EXPO_PUBLIC_GITHUB_CLIENT_ID,
);

export function useGitHubAccount() {
	const analytics = useMobileAnalytics();
	const [account] = useState(() =>
		createGitHubAccountState({
			restore: readGitHubSession,
			save: saveGitHubSession,
			clear: clearGitHubSession,
			begin: (signal) => beginGitHubSignIn(clientId, fetch, signal),
			finish: (code, signal) => finishGitHubSignIn(clientId, code, signal),
			refresh: (session, signal) =>
				refreshGitHubSession(session, clientId, fetch, signal),
			list: (session, page, signal) =>
				listGitHubRepositories(session, page, fetch, signal),
		}),
	);
	const state = useSyncExternalStore(
		account.subscribe,
		account.snapshot,
		account.snapshot,
	);
	useEffect(() => {
		void account.restore();
		return account.cancelSignIn;
	}, [account]);
	const signIn = useCallback(async () => {
		if (account.snapshot().busy) return;
		await account.signIn();
		captureSignInOutcome(account.snapshot(), analytics.capture);
	}, [account, analytics.capture]);
	return {
		...state,
		configured: Boolean(clientId.trim()),
		currentSession: account.currentSession,
		signIn,
		signOut: account.signOut,
		cancelSignIn: account.cancelSignIn,
		loadRepositories: account.loadRepositories,
	};
}

type SignInSnapshot = { session: unknown; error: string | null };
type Capture = (event: MobileAnalyticsEvent) => void;

export function captureSignInOutcome(
	snapshot: SignInSnapshot,
	capture: Capture,
) {
	if (snapshot.session) {
		capture({ name: "mobile_github_sign_in_completed", outcome: "success" });
		return;
	}
	if (!snapshot.error) {
		capture({ name: "mobile_github_sign_in_completed", outcome: "cancelled" });
		return;
	}
	capture({
		name: "mobile_github_sign_in_completed",
		outcome: "failed",
		failure_kind: signInFailureKind(snapshot.error),
	});
}

function signInFailureKind(
	error: string,
): "network" | "denied" | "timeout" | "unknown" {
	if (error === "mobile.vaults.networkFailed") return "network";
	if (error === "mobile.vaults.requestTimeout") return "timeout";
	if (error === "mobile.vaults.authFailed") return "denied";
	return "unknown";
}
