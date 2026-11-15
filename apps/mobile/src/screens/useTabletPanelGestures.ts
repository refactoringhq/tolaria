import { useCallback, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useWindowDimensions } from "react-native";
import {
	type SharedValue,
	useAnimatedStyle,
	useSharedValue,
	withSpring,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { desktopPanelParity } from "../ui/desktopParity";
import { mobileInspectorWidth } from "../ui/mobileMetrics";
import {
	createTabletPanGesture,
	type TabletPanelPosition,
	type TabletPanSession,
	tabletPanelSpring,
} from "./tabletNativePanGesture";
import { tabletPanelPositionAfterResize } from "./tabletPanelResize";
import {
	type TabletLeftPanelStage,
	tabletLeftPanelStageAfterDrag,
	tabletLeftPanelStageOffset,
} from "./tabletWorkspacePanelTransitions";
import { tabletLeftChromeMinWidth } from "./tabletWorkspaceScreenMode";

export type TabletPanelGestureOptions = {
	compactTablet: boolean;
	defaultPropertiesVisible: boolean;
	defaultSidebarVisible: boolean;
	exclusiveSidePanels: boolean;
	propertiesReplaceSidebar: boolean;
};

function initialLeftStage(
	options: TabletPanelGestureOptions,
): TabletLeftPanelStage {
	if (options.defaultPropertiesVisible && options.propertiesReplaceSidebar)
		return "editor";
	return options.compactTablet || !options.defaultSidebarVisible
		? "list"
		: "all";
}

type TabletPanMotionOptions = {
	compactTablet: boolean;
	propertiesReplaceSidebar: boolean;
	width: number;
	topInset: number;
	motion: {
		left: SharedValue<number>;
		properties: SharedValue<number>;
		restoreLeft: SharedValue<number>;
	};
	session: SharedValue<TabletPanSession>;
	epoch: SharedValue<number>;
	onSettle: (position: TabletPanelPosition, ticket: number) => void;
};

function useTabletPanMotion(options: TabletPanMotionOptions) {
	const {
		compactTablet,
		epoch,
		motion,
		onSettle,
		propertiesReplaceSidebar,
		session,
		topInset,
		width,
	} = options;
	return useMemo(
		() =>
			createTabletPanGesture({
				compactTablet,
				propertiesReplaceSidebar,
				width,
				topInset,
				motion,
				session,
				epoch,
				onSettle,
			}),
		[
			compactTablet,
			propertiesReplaceSidebar,
			width,
			topInset,
			motion,
			session,
			epoch,
			onSettle,
		],
	);
}

function useTabletChromeActions({
	position,
	propertiesReplaceSidebar,
	settle,
	sidebarOverList,
}: {
	position: TabletPanelPosition;
	propertiesReplaceSidebar: boolean;
	settle: (stage: TabletLeftPanelStage, visible: boolean) => void;
	sidebarOverList: boolean;
}) {
	const showLeftStage = useCallback(
		(stage: TabletLeftPanelStage) => settle(stage, false),
		[settle],
	);
	const toggleSidebar = useCallback(
		() => showLeftStage(position.stage === "all" ? "list" : "all"),
		[position.stage, showLeftStage],
	);
	const toggleSidebarAndNoteList = useCallback(
		() => showLeftStage(position.stage === "editor" ? "all" : "editor"),
		[position.stage, showLeftStage],
	);
	const finishSidebarNavigation = useCallback(() => {
		if (sidebarOverList) showLeftStage("list");
	}, [showLeftStage, sidebarOverList]);
	return {
		finishSidebarNavigation,
		hideLeftChrome: useCallback(() => showLeftStage("editor"), [showLeftStage]),
		showAllPanels: useCallback(
			() => settle("all", !propertiesReplaceSidebar),
			[propertiesReplaceSidebar, settle],
		),
		showEditorList: useCallback(() => showLeftStage("list"), [showLeftStage]),
		showEditorOnly: useCallback(() => showLeftStage("editor"), [showLeftStage]),
		showLeftChrome: useCallback(() => showLeftStage("all"), [showLeftStage]),
		toggleSidebar,
		toggleSidebarAndNoteList,
	};
}

type TabletPropertyActionOptions = {
	compactTablet: boolean;
	left: SharedValue<number>;
	position: TabletPanelPosition;
	propertiesReplaceSidebar: boolean;
	restoreLeft: SharedValue<number>;
	settle: (stage: TabletLeftPanelStage, visible: boolean) => void;
	width: number;
};

function useTabletPropertyActions(options: TabletPropertyActionOptions) {
	const {
		compactTablet,
		left,
		position,
		propertiesReplaceSidebar,
		restoreLeft,
		settle,
		width,
	} = options;
	const showProperties = useCallback(() => {
		if (!position.propertiesVisible) restoreLeft.set(left.value);
		settle(propertiesReplaceSidebar ? "editor" : position.stage, true);
	}, [left, position, propertiesReplaceSidebar, restoreLeft, settle]);
	const hideProperties = useCallback(() => {
		const stage = propertiesReplaceSidebar
			? tabletLeftPanelStageAfterDrag({
					compactTablet,
					stage: "all",
					startOffset: restoreLeft.value,
					dx: 0,
					vx: 0,
				})
			: position.stage;
		settle(
			tabletPanelPositionAfterResize(
				{ stage, propertiesVisible: false },
				width,
				compactTablet,
			).stage,
			false,
		);
	}, [
		compactTablet,
		position.stage,
		propertiesReplaceSidebar,
		restoreLeft,
		settle,
		width,
	]);
	const toggleProperties = useCallback(() => {
		if (position.propertiesVisible) hideProperties();
		else showProperties();
	}, [hideProperties, position.propertiesVisible, showProperties]);
	return {
		hideProperties,
		showProperties,
		toggleProperties,
	};
}

function useTabletPanelSettle({
	compactTablet,
	epoch,
	left,
	properties,
	session,
	setPosition,
}: {
	compactTablet: boolean;
	epoch: SharedValue<number>;
	left: SharedValue<number>;
	properties: SharedValue<number>;
	session: SharedValue<TabletPanSession>;
	setPosition: (position: TabletPanelPosition) => void;
}) {
	return useCallback(
		(stage: TabletLeftPanelStage, propertiesVisible: boolean) => {
			epoch.set((ticket) => ticket + 1);
			session.set({ ...session.get(), mode: "fail" });
			const normalized = compactTablet && stage === "all" ? "list" : stage;
			left.set(
				withSpring(
					tabletLeftPanelStageOffset(normalized, compactTablet),
					tabletPanelSpring,
				),
			);
			properties.set(
				withSpring(
					propertiesVisible ? 0 : mobileInspectorWidth,
					tabletPanelSpring,
				),
			);
			setPosition({ stage: normalized, propertiesVisible });
		},
		[compactTablet, epoch, left, properties, session, setPosition],
	);
}

function useTabletPanelLayoutEffects(options: {
	compactTablet: boolean;
	left: SharedValue<number>;
	position: TabletPanelPosition;
	settle: (stage: TabletLeftPanelStage, visible: boolean) => void;
	width: number;
}) {
	const { compactTablet, left, position, settle, width } = options;
	useWindowResize(width, () => {
		const next = tabletPanelPositionAfterResize(position, width, compactTablet);
		settle(next.stage, next.propertiesVisible);
	});
	useLayoutEffect(() => {
		left.set(
			withSpring(
				tabletLeftPanelStageOffset(position.stage, compactTablet),
				tabletPanelSpring,
			),
		);
	}, [compactTablet, left, position.stage]);
}

function useTabletPanelPresentation(options: {
	compactTablet: boolean;
	left: SharedValue<number>;
	options: TabletPanelGestureOptions;
	position: TabletPanelPosition;
	properties: SharedValue<number>;
	width: number;
}) {
	const {
		compactTablet,
		left,
		options: gestureOptions,
		position,
		properties,
		width,
	} = options;
	const sidebarOverList = sidebarReplacesList(gestureOptions, width);
	const leftChromeMotion = useLeftChromeMotion(
		left,
		compactTablet,
		sidebarOverList,
	);
	const propertiesMotionStyle = useAnimatedStyle(() => ({
		marginLeft: -properties.value,
		transform: [{ translateX: properties.value }],
	}));
	return {
		leftChromeMotion,
		noteListVisible: position.stage !== "editor",
		propertiesMotionStyle,
		showSidebar: position.stage === "all" && !compactTablet,
		sidebarOverList,
	};
}

function useTabletPanelState(options: TabletPanelGestureOptions) {
	const compactTablet = options.compactTablet;
	const [position, setPosition] = useState<TabletPanelPosition>(() => ({
		stage: initialLeftStage(options),
		propertiesVisible: options.defaultPropertiesVisible,
	}));
	const left = useSharedValue(
		tabletLeftPanelStageOffset(initialLeftStage(options), compactTablet),
	);
	const properties = useSharedValue(
		options.defaultPropertiesVisible ? 0 : mobileInspectorWidth,
	);
	const restoreLeft = useSharedValue(
		tabletLeftPanelStageOffset(
			options.defaultSidebarVisible ? "all" : "list",
			compactTablet,
		),
	);
	const session = useSharedValue<TabletPanSession>({
		x: 0,
		y: 0,
		left: 0,
		properties: 0,
		mode: "wait",
	});
	const epoch = useSharedValue(0);
	return {
		epoch,
		left,
		position,
		properties,
		restoreLeft,
		session,
		setPosition,
	};
}

function useTabletPanelController(options: {
	options: TabletPanelGestureOptions;
	state: ReturnType<typeof useTabletPanelState>;
	topInset: number;
	width: number;
}) {
	const { options: gestureOptions, state, topInset, width } = options;
	const { compactTablet, propertiesReplaceSidebar } = gestureOptions;
	const { epoch, left, properties, restoreLeft, session, setPosition } = state;
	const onSettle = useTabletPanelSettlement(epoch, session, setPosition);
	const motion = useMemo(
		() => ({ left, properties, restoreLeft }),
		[left, properties, restoreLeft],
	);
	const panGesture = useTabletPanMotion({
		compactTablet,
		epoch,
		motion,
		onSettle,
		propertiesReplaceSidebar,
		session,
		topInset,
		width,
	});
	const settle = useTabletPanelSettle({
		compactTablet,
		epoch,
		left,
		properties,
		session,
		setPosition,
	});
	useTabletPanelLayoutEffects({
		compactTablet,
		left,
		position: state.position,
		settle,
		width,
	});
	return { panGesture, settle };
}

export function useTabletPanelGestures(options: TabletPanelGestureOptions) {
	const { width } = useWindowDimensions();
	const { top: topInset } = useSafeAreaInsets();
	const { compactTablet, propertiesReplaceSidebar } = options;
	const state = useTabletPanelState(options);
	const { left, position, properties, restoreLeft } = state;
	const { panGesture, settle } = useTabletPanelController({
		options,
		state,
		topInset,
		width,
	});
	const presentation = useTabletPanelPresentation({
		compactTablet,
		left,
		options,
		position,
		properties,
		width,
	});
	const chromeActions = useTabletChromeActions({
		position,
		propertiesReplaceSidebar,
		settle,
		sidebarOverList: presentation.sidebarOverList,
	});
	const propertyActions = useTabletPropertyActions({
		compactTablet,
		left,
		position,
		propertiesReplaceSidebar,
		restoreLeft,
		settle,
		width,
	});
	return {
		...chromeActions,
		...propertyActions,
		...presentation.leftChromeMotion,
		leftChromeVisible: true,
		noteListVisible: presentation.noteListVisible,
		panGesture,
		propertiesMotionStyle: presentation.propertiesMotionStyle,
		propertiesPanelVisible: true,
		propertiesVisible: position.propertiesVisible,
		renderNoteList: true,
		renderSidebar: !compactTablet,
		showSidebar: presentation.showSidebar,
	};
}

function useTabletPanelSettlement(
	epoch: SharedValue<number>,
	session: SharedValue<TabletPanSession>,
	onSettle: (position: TabletPanelPosition) => void,
) {
	useLayoutEffect(
		() => () => {
			epoch.set((ticket) => ticket + 1);
			session.set({ ...session.get(), mode: "fail" });
		},
		[epoch, session],
	);
	return useCallback(
		(position: TabletPanelPosition, ticket: number) => {
			if (epoch.get() === ticket) onSettle(position);
		},
		[epoch, onSettle],
	);
}

function sidebarReplacesList(
	options: TabletPanelGestureOptions,
	width: number,
) {
	return (
		!options.compactTablet &&
		options.propertiesReplaceSidebar &&
		width < tabletLeftChromeMinWidth
	);
}

function useLeftChromeMotion(
	left: SharedValue<number>,
	compact: boolean,
	sidebarOverList: boolean,
) {
	const stripWidth =
		desktopPanelParity.noteListWidth +
		(compact ? 0 : desktopPanelParity.sidebarWidth);
	const maximumWidth = sidebarOverList
		? desktopPanelParity.noteListWidth
		: stripWidth;
	const leftChromeViewportStyle = useAnimatedStyle(() => ({
		width: Math.max(0, Math.min(maximumWidth, stripWidth + left.value)),
	}));
	const leftChromeMotionStyle = useAnimatedStyle(() => {
		const transform = [{ translateX: left.value }];
		return compact
			? { marginRight: left.value, transform }
			: { width: stripWidth, transform };
	});
	return { leftChromeMotionStyle, leftChromeViewportStyle };
}

function useWindowResize(width: number, onResize: () => void) {
	const previousWidth = useRef(width);
	useLayoutEffect(() => {
		if (previousWidth.current === width) return;
		previousWidth.current = width;
		onResize();
	}, [onResize, width]);
}
