import { useCallback, useEffect, useRef, useState } from "react";
import type {
	LayoutChangeEvent,
	NativeScrollEvent,
	NativeSyntheticEvent,
	ScrollView,
} from "react-native";
import {
	type NativeTableOfContentsProof,
	nativeTableOfContentsScrollProof,
} from "../qa/nativeTableOfContentsProbe";
import { useMobileMetrics } from "../ui/theme/useMobileTheme";
import type { MobileTableOfContentsTarget } from "../workspace/mobileTableOfContents";
import type { TableOfContentsScroll } from "./TabletEditorPanel.types";

export function useTableOfContentsScroll(
	target: MobileTableOfContentsTarget | null,
	onProof?: (proof: NativeTableOfContentsProof) => void,
): TableOfContentsScroll {
	const metrics = useMobileMetrics();
	const [layoutVersion, setLayoutVersion] = useState(0);
	const [scrollViewVersion, setScrollViewVersion] = useState(0);
	const scrollViewRef = useRef<ScrollView | null>(null);
	const scrollYRef = useRef(0);
	const targetOffsetsRef = useRef<Record<string, number>>({});
	const setScrollViewNode = useCallback((node: ScrollView | null) => {
		scrollViewRef.current = node;
		setScrollViewVersion((current) => current + 1);
	}, []);
	const onScroll = useCallback(
		(event: NativeSyntheticEvent<NativeScrollEvent>) => {
			scrollYRef.current = event.nativeEvent.contentOffset.y;
		},
		[],
	);
	const onTargetLayout = useCallback(
		(targetId: string, event: LayoutChangeEvent) => {
			targetOffsetsRef.current[targetId] = event.nativeEvent.layout.y;
			setLayoutVersion((current) => current + 1);
		},
		[],
	);

	useEffect(() => {
		if (!target) return;
		const y = targetOffsetsRef.current[target.id];
		if (typeof y !== "number") return;
		const scrollView = scrollViewRef.current;
		if (!scrollView) return;
		const beforeY = scrollYRef.current;
		const expectedY = Math.max(0, y - metrics.editor.contentPaddingVertical);
		scrollView.scrollTo({ animated: true, y: expectedY });
		if (!onProof) return;

		const proofTimeout = setTimeout(() => {
			onProof(
				nativeTableOfContentsScrollProof({
					afterY: scrollYRef.current,
					beforeY,
					expectedY,
					targetId: target.id,
				}),
			);
		}, 900);
		return () => clearTimeout(proofTimeout);
	}, [layoutVersion, onProof, scrollViewVersion, target, metrics]);

	return { onScroll, onTargetLayout, setScrollViewNode };
}
