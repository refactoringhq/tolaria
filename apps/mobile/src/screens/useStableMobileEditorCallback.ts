import { useCallback, useLayoutEffect, useRef } from "react";

export function useStableMobileEditorCallback(
	callback: (noteId: string, content: string) => void,
) {
	const currentCallback = useRef(callback);
	useLayoutEffect(() => {
		currentCallback.current = callback;
	}, [callback]);
	return useCallback(
		(noteId: string, content: string) =>
			currentCallback.current(noteId, content),
		[],
	);
}
