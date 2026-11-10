import { useEffect, useRef } from "react";
import {
	logMobileMotionBodyRender,
	mobileMotionFrameProbeEnabled,
} from "./mobileMotionFrameLog";

export function useMobileMotionBodyRender(
	compact: boolean,
	noteId: string,
	rawContent: string | undefined,
) {
	const renderCount = useRef(0);
	useEffect(() => {
		if (!mobileMotionFrameProbeEnabled) return;
		renderCount.current += 1;
		logMobileMotionBodyRender(compact, noteId, rawContent, renderCount.current);
	});
}
