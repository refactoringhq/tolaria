import { useEffect, useRef } from "react";
import { changedMotionRenderInputs } from "./mobileMotionBodyRenderInputs";
import {
	logMobileMotionBodyRender,
	mobileMotionFrameProbeEnabled,
} from "./mobileMotionFrameLog";

export function useMobileMotionBodyRender(
	compact: boolean,
	noteId: string,
	rawContent: string | undefined,
	renderInputs: Record<string, unknown>,
) {
	const renderCount = useRef(0);
	const previousInputs = useRef<Record<string, unknown> | undefined>(undefined);
	useEffect(() => {
		if (!mobileMotionFrameProbeEnabled) return;
		renderCount.current += 1;
		const changedInputs = changedMotionRenderInputs(
			previousInputs.current,
			renderInputs,
		);
		previousInputs.current = renderInputs;
		logMobileMotionBodyRender(compact, {
			noteId,
			rawContent,
			render: renderCount.current,
			changedInputs,
		});
	});
}
