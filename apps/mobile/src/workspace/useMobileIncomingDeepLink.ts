import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Linking } from "react-native";
import { useMobileAnalytics } from "../analytics/useMobileAnalytics";
import { mobileText } from "../i18n/mobileText";
import {
	type MobileDeepLinkPath,
	type MobileDeepLinkSlug,
	type MobileDeepLinkVaultChoice,
	parseMobileIncomingDeepLink,
	resolveMobileDeepLinkNote,
	resolveMobileDeepLinkVault,
} from "./mobileDeepLinks";
import type { MobileWorkspaceSnapshot } from "./mobileWorkspaceModel";

type PendingLink = {
	relativePath: MobileDeepLinkPath;
	requestId: number;
	slug: MobileDeepLinkSlug;
};
export type MobileDeepLinkNavigationRequest = {
	noteId: string;
	requestId: number;
};
type VaultPicker = { choices: MobileDeepLinkVaultChoice[] } | null;
type IncomingLinkState = {
	latestRequestId: { current: number };
	mounted: { current: boolean };
	notice: string | null;
	pending: PendingLink | null;
	setNotice: (message: string | null) => void;
	setPending: (link: PendingLink | null) => void;
};
type RouteResolution =
	| {
			kind: "failure";
			messageKey: Parameters<typeof mobileText>[0];
			outcome: "unknown_vault" | "ambiguous_vault" | "missing_file";
	  }
	| { kind: "open"; noteId: string }
	| { kind: "select"; vault: MobileDeepLinkVaultChoice }
	| { kind: "wait" };

export function useMobileIncomingDeepLink(
	picker: VaultPicker,
	snapshot: MobileWorkspaceSnapshot,
) {
	const analytics = useMobileAnalytics();
	const incoming = useIncomingLinkState();
	const [navigation, setNavigation] = useIncomingLinkSelection({
		analytics,
		incoming,
		picker,
		snapshot,
	});
	const acknowledgeNavigation = useCallback(
		(requestId: number) => {
			setNavigation((current) =>
				current?.requestId === requestId ? null : current,
			);
		},
		[setNavigation],
	);
	return { navigation, notice: incoming.notice, acknowledgeNavigation };
}

function useIncomingLinkState(): IncomingLinkState {
	const [pending, setPending] = useState<PendingLink | null>(null);
	const [notice, setNotice] = useState<string | null>(null);
	const latestRequestId = useRef(0);
	const mounted = useRef(false);
	useIncomingLinkEvents(setPending, setNotice, latestRequestId, mounted);
	useNoticeTimeout(notice, setNotice);
	return useMemo(
		() => ({
			latestRequestId,
			mounted,
			notice,
			pending,
			setNotice,
			setPending,
		}),
		[notice, pending],
	);
}

function useIncomingLinkEvents(
	setPending: IncomingLinkState["setPending"],
	setNotice: IncomingLinkState["setNotice"],
	latestRequestId: IncomingLinkState["latestRequestId"],
	mountedRef: IncomingLinkState["mounted"],
) {
	useEffect(() => {
		mountedRef.current = true;
		let receivedWarmUrl = false;
		const receive = (url: string) => {
			const parsed = parseMobileIncomingDeepLink(url);
			if (parsed.kind === "ignored") return;
			receivedWarmUrl = true;
			latestRequestId.current += 1;
			receiveIncomingUrl(
				parsed,
				latestRequestId.current,
				setPending,
				setNotice,
			);
		};
		const subscription = Linking.addEventListener("url", ({ url }) =>
			receive(url),
		);
		Linking.getInitialURL()
			.then((url) => {
				if (url && mountedRef.current && !receivedWarmUrl) {
					const parsed = parseMobileIncomingDeepLink(url);
					if (parsed.kind === "ignored") return;
					latestRequestId.current += 1;
					receiveIncomingUrl(
						parsed,
						latestRequestId.current,
						setPending,
						setNotice,
					);
				}
			})
			.catch(() => {});
		return () => {
			mountedRef.current = false;
			subscription.remove();
		};
	}, [setNotice, setPending, latestRequestId, mountedRef]);
}

function receiveIncomingUrl(
	parsed: ReturnType<typeof parseMobileIncomingDeepLink>,
	requestId: number,
	setPending: IncomingLinkState["setPending"],
	setNotice: IncomingLinkState["setNotice"],
) {
	if (parsed.kind === "ignored") return;
	if (parsed.kind === "invalid") {
		setNotice(messageForError(parsed.error));
		setPending(null);
		return;
	}
	setNotice(null);
	setPending({
		relativePath: parsed.relativePath,
		requestId,
		slug: parsed.slug,
	});
}

function useNoticeTimeout(
	notice: string | null,
	setNotice: IncomingLinkState["setNotice"],
) {
	useEffect(() => {
		if (!notice) return undefined;
		const timeout = setTimeout(() => setNotice(null), 8_000);
		return () => clearTimeout(timeout);
	}, [notice, setNotice]);
}

function useIncomingLinkSelection({
	analytics,
	incoming,
	picker,
	snapshot,
}: {
	analytics: ReturnType<typeof useMobileAnalytics>;
	incoming: IncomingLinkState;
	picker: VaultPicker;
	snapshot: MobileWorkspaceSnapshot;
}) {
	const [navigation, setNavigation] =
		useState<MobileDeepLinkNavigationRequest | null>(null);
	const selecting = useRef<number | null>(null);
	useEffect(() => {
		const pending = incoming.pending;
		if (!pending || !picker?.choices.length) return;
		void Promise.resolve().then(() => {
			if (
				!incoming.mounted.current ||
				incoming.latestRequestId.current !== pending.requestId
			)
				return;
			const resolution = resolvePendingLink(pending, picker, snapshot);
			applyRouteResolution(resolution, {
				analytics,
				incoming,
				selecting,
				setNavigation,
			});
		});
	}, [analytics, incoming, picker, snapshot]);
	return [navigation, setNavigation] as const;
}

function resolvePendingLink(
	pending: PendingLink,
	picker: NonNullable<VaultPicker>,
	snapshot: MobileWorkspaceSnapshot,
): RouteResolution {
	const resolved = resolveMobileDeepLinkVault(pending.slug, picker.choices);
	if (resolved.kind !== "matched") {
		return resolved.kind === "unknown"
			? {
					kind: "failure",
					messageKey: "deepLinks.error.unknownVault",
					outcome: "unknown_vault",
				}
			: {
					kind: "failure",
					messageKey: "deepLinks.error.ambiguousVault",
					outcome: "ambiguous_vault",
				};
	}
	if (!resolved.vault.selected)
		return { kind: "select", vault: resolved.vault };
	if (!activeVaultMatches(snapshot, pending.slug)) return { kind: "wait" };
	const noteId = resolveMobileDeepLinkNote(snapshot, pending.relativePath);
	return noteId
		? { kind: "open", noteId }
		: {
				kind: "failure",
				messageKey: "deepLinks.error.missingFile",
				outcome: "missing_file",
			};
}

function applyRouteResolution(
	resolution: RouteResolution,
	{
		analytics,
		incoming,
		selecting,
		setNavigation,
	}: {
		analytics: ReturnType<typeof useMobileAnalytics>;
		incoming: IncomingLinkState;
		selecting: { current: number | null };
		setNavigation: (navigation: MobileDeepLinkNavigationRequest) => void;
	},
) {
	const requestId = incoming.pending?.requestId;
	if (
		resolution.kind === "wait" ||
		requestId === undefined ||
		incoming.latestRequestId.current !== requestId
	)
		return;
	if (resolution.kind === "failure") {
		analytics.capture({
			name: "mobile_deep_link_opened",
			outcome: resolution.outcome,
		});
		incoming.setNotice(mobileText(resolution.messageKey));
		incoming.setPending(null);
		return;
	}
	if (resolution.kind === "select") {
		selectDeepLinkVault(resolution.vault, {
			analytics,
			incoming,
			selecting,
			requestId,
		});
		return;
	}
	incoming.setPending(null);
	analytics.capture({ name: "mobile_deep_link_opened", outcome: "opened" });
	setNavigation({ noteId: resolution.noteId, requestId });
	incoming.setNotice(null);
}

function selectDeepLinkVault(
	vault: MobileDeepLinkVaultChoice,
	{
		analytics,
		incoming,
		selecting,
		requestId,
	}: {
		analytics: ReturnType<typeof useMobileAnalytics>;
		incoming: IncomingLinkState;
		selecting: { current: number | null };
		requestId: number;
	},
) {
	if (selecting.current === requestId) return;
	selecting.current = requestId;
	void vault
		.select()
		.catch(() => {
			if (
				!incoming.mounted.current ||
				incoming.latestRequestId.current !== requestId
			)
				return;
			analytics.capture({
				name: "mobile_deep_link_opened",
				outcome: "unavailable_vault",
			});
			incoming.setNotice(mobileText("deepLinks.error.unavailableVault"));
			incoming.setPending(null);
		})
		.finally(() => {
			if (selecting.current === requestId) selecting.current = null;
		});
}

function activeVaultMatches(
	snapshot: MobileWorkspaceSnapshot,
	slug: string,
): boolean {
	const source = snapshot.source;
	return (
		!source ||
		slugify(source.label) === slug ||
		slugify(source.alias ?? "") === slug
	);
}

function messageForError(error: string): string {
	const keys: Record<string, Parameters<typeof mobileText>[0]> = {
		malformed_url: "deepLinks.error.malformedUrl",
		missing_path: "deepLinks.error.missingPath",
		missing_vault: "deepLinks.error.missingVault",
		unsafe_path: "deepLinks.error.unsafePath",
	};
	return mobileText(keys[error] ?? "deepLinks.error.malformedUrl");
}

function slugify(value: string): string {
	return value
		.trim()
		.toLocaleLowerCase()
		.replace(/[^a-z0-9]+/gu, "-")
		.replace(/^-+|-+$/gu, "");
}
