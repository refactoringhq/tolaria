import { useCallback, useLayoutEffect, useRef } from "react";
import { useMobileAnalytics } from "../../analytics/useMobileAnalytics";
import type { NativeTentapEditorBridgeOptions } from "./MobileNativeEditor.types";
import { showMobileEditorLinkMenu } from "./mobileEditorLinkMenu.native";
import { routeMobileWysiwygLink } from "./mobileWysiwygLinkRouting";

export function useMobileNativeEditorLinkActions(
	options: NativeTentapEditorBridgeOptions,
) {
	const analytics = useMobileAnalytics();
	const handlers = useRef({
		onNavigateWikilink: options.onNavigateWikilink,
		onOpenLink: options.onOpenLink,
	});
	const analyticsRef = useRef(analytics);
	useLayoutEffect(() => {
		handlers.current = {
			onNavigateWikilink: options.onNavigateWikilink,
			onOpenLink: options.onOpenLink,
		};
		analyticsRef.current = analytics;
	}, [analytics, options.onNavigateWikilink, options.onOpenLink]);
	const onLinkTap = useCallback((href: string) => {
		const kind = routeMobileWysiwygLink(href, handlers.current);
		if (kind && kind !== "deepLink")
			analyticsRef.current.capture({
				name: "mobile_note_link_activated",
				kind,
			});
	}, []);
	const onLinkLongPress = useCallback(
		(href: string) => {
			const kind = routeMobileWysiwygLink(href, {
				onNavigateWikilink: () => undefined,
				onOpenLink: () => undefined,
			});
			if (!kind) return;
			const analyticsKind = kind === "external" ? "external" : "wikilink";
			analyticsRef.current.capture({
				name: "mobile_note_link_options_opened",
				kind: analyticsKind,
			});
			showMobileEditorLinkMenu(
				href,
				analyticsKind,
				() => onLinkTap(href),
				(name, linkKind) =>
					analyticsRef.current.capture({ name, kind: linkKind }),
			);
		},
		[onLinkTap],
	);
	return { onLinkTap, onLinkLongPress };
}
