import type { useCreateBlockNote } from "@blocknote/react";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import type { AppLocale } from "../lib/i18n";
import type { RawEditorFindRequest } from "./RawEditorFindBar";
import { RichEditorFindBar } from "./RichEditorFindBar";

export function RichEditorFindHost({
	editor,
	locale,
	path,
	rawMode,
}: {
	editor: ReturnType<typeof useCreateBlockNote>;
	locale?: AppLocale;
	path: string | null;
	rawMode: boolean;
}) {
	const target = useRichFindHostTarget(path, rawMode);
	const request = useRichFindRequest(path);

	return path && !rawMode && target && request?.path === path
		? createPortal(
				<RichEditorFindBar
					editor={editor}
					locale={locale}
					path={path}
					request={request}
				/>,
				target,
			)
		: null;
}

function useRichFindRequest(path: string | null): RawEditorFindRequest | null {
	const [request, setRequest] = useState<RawEditorFindRequest | null>(null);
	useEffect(() => {
		const onFindRequest = (event: Event) => {
			const detail = (event as CustomEvent<RawEditorFindRequest>).detail;
			if (detail?.path === path) setRequest(detail);
		};
		window.addEventListener("laputa:rich-editor-find-request", onFindRequest);
		return () =>
			window.removeEventListener(
				"laputa:rich-editor-find-request",
				onFindRequest,
			);
	}, [path]);
	return request;
}

function useRichFindHostTarget(
	path: string | null,
	rawMode: boolean,
): HTMLElement | null {
	const [target, setTarget] = useState<HTMLElement | null>(null);
	useEffect(() => {
		if (!path || rawMode) return;
		const frame = requestAnimationFrame(() => {
			setTarget(
				document.querySelector<HTMLElement>(
					'.editor-scroll-area[data-editor-find-scope="true"]',
				),
			);
		});
		return () => cancelAnimationFrame(frame);
	}, [path, rawMode]);
	return target;
}
