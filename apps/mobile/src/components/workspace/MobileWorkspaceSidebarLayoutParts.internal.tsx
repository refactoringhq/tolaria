import type { ReactNode } from "react";
import { type LayoutChangeEvent, ScrollView, View } from "react-native";
import { MobileLayoutProbeReadout } from "../../qa/MobileLayoutProbeReadout";
import type { useMobileLayoutProbe } from "../../qa/mobileLayoutProbe";
import { MobileSidebarSettings } from "./MobileSidebarSettings";
import type { createSidebarStyles } from "./mobileSidebarStyles";

type SidebarLayoutStyles = ReturnType<typeof createSidebarStyles>["styles"];

export function MobileSidebarSectionsScroll({
	children,
	controlsHeight,
	layoutProbe,
	scrollsToTop = false,
	styles,
}: {
	children: ReactNode;
	controlsHeight: number;
	layoutProbe: ReturnType<typeof useMobileLayoutProbe>;
	scrollsToTop?: boolean;
	styles: SidebarLayoutStyles;
}) {
	return (
		<ScrollView
			{...layoutProbe.probe("sidebar.scroll")}
			scrollsToTop={scrollsToTop}
			testID="sidebar-scroll"
			style={styles.scroll}
			contentContainerStyle={[
				styles.content,
				{ paddingBottom: controlsHeight },
			]}
			scrollIndicatorInsets={{ bottom: controlsHeight }}
		>
			{children}
		</ScrollView>
	);
}

export function MobileSidebarFooter({
	layoutProbe,
	onLayout,
	onOpenCommandPalette,
	showLayoutProbe,
	styles,
}: {
	layoutProbe: ReturnType<typeof useMobileLayoutProbe>;
	onLayout: (event: LayoutChangeEvent) => void;
	onOpenCommandPalette?: () => void;
	showLayoutProbe: boolean;
	styles: SidebarLayoutStyles;
}) {
	return (
		<>
			<View
				pointerEvents="box-none"
				style={styles.floatingControls}
				onLayout={onLayout}
				testID="sidebar-floating-controls"
			>
				<MobileSidebarSettings onOpenCommandPalette={onOpenCommandPalette} />
			</View>
			{showLayoutProbe ? (
				<MobileLayoutProbeReadout
					metrics={layoutProbe.metrics}
					testID="sidebar-layout-metrics"
				/>
			) : null}
		</>
	);
}
