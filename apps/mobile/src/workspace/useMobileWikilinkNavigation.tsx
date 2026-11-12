import { useCallback, useLayoutEffect, useRef, useState } from "react";
import { MobileTransientNotice } from "../components/workspace/MobileTransientNotice.internal";
import { mobileText } from "../i18n/mobileText";
import { createMobileWikilinkNavigator } from "./mobileWikilinkNavigation";
import type { MobileNote } from "./mobileWorkspaceModel";

export function useMobileWikilinkNavigation(
	notes: MobileNote[],
	onNavigate: (target: string) => void,
) {
	const [missing, setMissing] = useState(false);
	const navigator = useRef(
		createMobileWikilinkNavigator(notes, onNavigate, () => setMissing(true)),
	);
	useLayoutEffect(() => {
		navigator.current = createMobileWikilinkNavigator(notes, onNavigate, () =>
			setMissing(true),
		);
	}, [notes, onNavigate]);
	const navigateWikilink = useCallback(
		(target: string) => navigator.current(target),
		[],
	);
	const dismiss = useCallback(() => setMissing(false), []);
	const notice = (
		<MobileTransientNotice
			message={missing ? mobileText("noteList.empty.noMatching") : null}
			onDismiss={dismiss}
		/>
	);
	return { navigateWikilink, notice };
}
