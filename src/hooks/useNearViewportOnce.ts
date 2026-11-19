import { type RefObject, useEffect, useState } from "react";

interface NearViewportOptions {
	/** Start visible without observing, e.g. the first PDF page. */
	eager?: boolean;
	rootMargin?: string;
}

function canObserveIntersections(): boolean {
	return typeof IntersectionObserver !== "undefined";
}

/** True once the element first comes near the viewport; stays true. Eager when IntersectionObserver is missing. */
export function useNearViewportOnce(
	ref: RefObject<Element | null>,
	{ eager = false, rootMargin = "600px 0px" }: NearViewportOptions = {},
): boolean {
	const [near, setNear] = useState(() => eager || !canObserveIntersections());

	useEffect(() => {
		const element = ref.current;
		if (near || !element) return undefined;

		const observer = new IntersectionObserver(
			(entries) => {
				if (!entries.some((entry) => entry.isIntersecting)) return;
				setNear(true);
				observer.disconnect();
			},
			{ rootMargin },
		);
		observer.observe(element);
		return () => observer.disconnect();
	}, [near, ref, rootMargin]);

	return near;
}
