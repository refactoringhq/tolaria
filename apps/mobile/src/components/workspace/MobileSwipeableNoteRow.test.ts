// @vitest-environment jsdom
import { createElement, type ReactNode } from "react";
import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { fixtureNotes } from "../../fixtures/workspaceFixtures";
import {
	MobileListMotion,
	MobileSwipeableNoteRow,
} from "./MobileSwipeableNoteRow";

const nativeSwipe = vi.hoisted(() =>
	vi.fn<(props: Record<string, unknown>) => null>(() => null),
);
const input = vi.hoisted(() => ({
	reduceMotion: false,
	onEnd: undefined as ((event: { translationX: number }) => void) | undefined,
	onUpdate: undefined as
		| ((event: { translationX: number }) => void)
		| undefined,
	onStart: undefined as (() => void) | undefined,
	onFinalize: undefined as (() => void) | undefined,
	onLayout: undefined as
		| ((event: {
				nativeEvent: {
					layout: { x: number; y: number; width: number; height: number };
				};
		  }) => void)
		| undefined,
	onArchive: vi.fn(),
	onOrganize: vi.fn(),
	animatedProps: undefined as Record<string, unknown> | undefined,
	swipeableMethods: {
		close: vi.fn(),
		openLeft: vi.fn(),
		openRight: vi.fn(),
		reset: vi.fn(),
	},
	events: [] as string[],
	timingCallbacks: [] as Array<(finished: boolean) => void>,
	vibrate: vi.fn(),
}));
vi.mock("react-native-gesture-handler/ReanimatedSwipeable", () => ({
	default: (props: Record<string, unknown> & { ref?: unknown }) => {
		assignSwipeableRef(props.ref);
		nativeSwipe(props);
		return null;
	},
}));

function assignSwipeableRef(value: unknown) {
	if (!value) return;
	if (typeof value !== "object") return;
	(value as { current: unknown }).current = input.swipeableMethods;
}

vi.mock("react-native", () => ({
	StyleSheet: { create: (styles: unknown) => styles },
	Vibration: { vibrate: input.vibrate },
	View: ({
		children,
		onLayout,
	}: {
		children: ReactNode;
		onLayout: typeof input.onLayout;
	}) => {
		input.onLayout = onLayout;
		return children;
	},
}));
vi.mock("phosphor-react-native", () => ({ CheckCircle: () => null }));
vi.mock("react-native-gesture-handler", () => ({
	GestureDetector: ({ children }: { children: ReactNode }) => children,
	Gesture: {
		Pan: () => {
			const pan = {
				onStart: (handler: typeof input.onStart) => {
					input.onStart = handler;
					return pan;
				},
				activeOffsetX: () => pan,
				failOffsetX: () => pan,
				failOffsetY: () => pan,
				onEnd: (handler: typeof input.onEnd) => {
					input.onEnd = handler;
					return pan;
				},
				onFinalize: (handler: typeof input.onFinalize) => {
					input.onFinalize = handler;
					return pan;
				},
				onUpdate: (handler: typeof input.onUpdate) => {
					input.onUpdate = handler;
					return pan;
				},
			};
			return pan;
		},
	},
}));
vi.mock("react-native-reanimated", () => ({
	useAnimatedReaction: () => null,
	useAnimatedStyle: (style: () => unknown) => style(),
	useDerivedValue: (value: () => number) => ({ get: value }),
	useFrameCallback: () => null,
	useAnimatedRef: () => ({ current: null }),
	measure: () => null,
	makeMutable: (initial: unknown) => {
		let value = initial;
		return { get: () => value, set: (next: unknown) => (value = next) };
	},
	default: {
		View: ({ children, ...props }: { children: ReactNode }) => {
			recordAnimationProps(props);
			return children;
		},
	},
	LinearTransition: {
		duration: (duration: number) => ({ kind: "layout", duration }),
	},
	FadeInDown: {
		duration: (duration: number) => ({ kind: "enter-surface", duration }),
	},
	FadeOutUp: {
		duration: (duration: number) => ({ kind: "exit-surface", duration }),
	},
	SlideOutLeft: {
		duration: (duration: number) => ({ kind: "exit", duration }),
	},
	SlideInLeft: {
		duration: (duration: number) => ({ kind: "enter", duration }),
	},
	useReducedMotion: () => input.reduceMotion,
	useSharedValue: (initial: unknown) => {
		let value = initial;
		return Object.freeze({
			get: () => value,
			set: (next: unknown) => {
				value = next;
			},
		});
	},
	withTiming: (
		value: number,
		_config: unknown,
		callback?: (finished: boolean) => void,
	) => {
		if (callback) input.timingCallbacks.push(callback);
		return value;
	},
	withDelay: (_delay: number, animation: unknown) => animation,
	runOnJS: (callback: (...args: unknown[]) => void) => callback,
}));

function recordAnimationProps(props: Record<string, unknown>) {
	if (animationProps.some((key) => props[key] !== undefined))
		input.animatedProps = props;
}

const animationProps = ["entering", "exiting", "layout"];

vi.mock("../../ui/theme/useMobileTheme", () => ({
	useMobileColors: () => ({ card: "#fff" }),
}));
vi.mock("../../analytics/useMobileAnalytics", () => ({
	useMobileAnalytics: () => ({ capture: vi.fn() }),
}));
vi.mock("./MobileNoteSwipeActions", () => ({
	MobileNoteSwipeActions: () => null,
}));

afterEach(() => {
	nativeSwipe.mockClear();
	input.onArchive.mockClear();
	input.onOrganize.mockClear();
	input.vibrate.mockClear();
	input.swipeableMethods.close.mockClear();
	input.swipeableMethods.openLeft.mockClear();
	input.swipeableMethods.openRight.mockClear();
	input.swipeableMethods.reset.mockClear();
	input.events = [];
	input.timingCallbacks = [];
	input.onOrganize.mockImplementation(() => input.events.push("organize"));
	input.animatedProps = undefined;
	input.reduceMotion = false;
	input.onStart = undefined;
	input.onFinalize = undefined;
	input.onUpdate = undefined;
	input.onEnd = undefined;
});

describe("note row input ownership", () => {
	it("leaves two-finger trackpad scrolling to the note list", () => {
		const props = renderRow();
		expect(props.enableTrackpadTwoFingerGesture).toBe(false);
		expect(props.renderLeftActions).toBeUndefined();
		expect(props.dragOffsetFromLeftEdge).toBe(Number.MAX_SAFE_INTEGER);
		expect(props.renderRightActions).toEqual(expect.any(Function));
	});

	it("does not install swipe actions on a disabled row", () => {
		renderRow(true);
		expect(nativeSwipe).not.toHaveBeenCalled();
	});

	it("uses the measured width to commit a full swipe with compiler-safe shared values", () => {
		renderRow();
		input.onLayout?.({
			nativeEvent: { layout: { x: 0, y: 0, width: 300, height: 96 } },
		});
		input.onUpdate?.({ translationX: -290 });
		finishSwipe();
		expect(input.onArchive).toHaveBeenCalledWith(
			[fixtureNotes[0].id],
			!fixtureNotes[0].archived,
		);
	});

	it("commits the full-swipe action after the row exit and collapse", () => {
		renderRow(false, "organize");
		input.onLayout?.({
			nativeEvent: { layout: { x: 0, y: 0, width: 300, height: 96 } },
		});
		input.onUpdate?.({ translationX: -290 });
		expect(input.onOrganize).not.toHaveBeenCalled();
		finishSwipe();
		expect(input.onOrganize).toHaveBeenCalledWith([fixtureNotes[0].id]);
		expect(input.onArchive).not.toHaveBeenCalled();
	});

	it("keeps the Organize pane visible until the row has collapsed", () => {
		renderRow(false, "organize");
		setSwipeWidth();
		beginSwipe();
		crossSwipeThreshold();
		input.onEnd?.({ translationX: -290 });
		expect(input.onOrganize).not.toHaveBeenCalled();
		expect(input.timingCallbacks).toHaveLength(1);
		input.timingCallbacks.shift()?.(true);
		expect(input.onOrganize).not.toHaveBeenCalled();
		expect(input.timingCallbacks).toHaveLength(1);
		input.timingCallbacks.shift()?.(true);
		expect(input.onOrganize).toHaveBeenCalledWith([fixtureNotes[0].id]);
	});

	it("does not reset the swipeable before committing a full-swipe action", () => {
		renderRow(false, "organize");
		setSwipeWidth();
		input.swipeableMethods.reset.mockImplementation(() =>
			input.events.push("reset"),
		);
		input.onOrganize.mockImplementation(() => input.events.push("organize"));
		beginSwipe();
		crossSwipeThreshold();
		finishSwipe();
		expect(input.events).toEqual(["organize"]);
		expect(input.swipeableMethods.reset).not.toHaveBeenCalled();
	});

	it("keeps a partial swipe revealed without resetting the swipeable", () => {
		renderRow(false, "organize");
		setSwipeWidth();
		input.onEnd?.({ translationX: -120 });

		expect(input.swipeableMethods.reset).not.toHaveBeenCalled();
		expect(input.onOrganize).not.toHaveBeenCalled();
	});

	it("animates removal and commits once per completed full swipe", () => {
		renderRow(false, "organize");
		expect(input.animatedProps).toMatchObject({
			entering: { duration: 220, kind: "enter" },
			exiting: { duration: 220, kind: "exit" },
			layout: { duration: 180, kind: "layout" },
		});
		setSwipeWidth();
		beginSwipe();
		crossSwipeThreshold();
		crossSwipeThreshold();
		expect(input.vibrate).toHaveBeenCalledTimes(1);
		finishSwipe();
		finishSwipe();
		expect(input.onOrganize).toHaveBeenCalledTimes(1);
		beginSwipe();
		crossSwipeThreshold();
		finishSwipe();
		expect(input.onOrganize).toHaveBeenCalledTimes(2);
		expect(input.vibrate).toHaveBeenCalledTimes(2);
	});

	it("disables list transitions when Reduce Motion is enabled", () => {
		input.reduceMotion = true;
		renderRow(false, "organize");
		expect(input.animatedProps).toBeUndefined();
	});

	it("animates non-row surfaces as they enter, leave, and change layout", () => {
		const root = createRoot(document.createElement("div"));
		try {
			flushSync(() =>
				root.render(
					createElement(MobileListMotion, {
						children: "Actions",
						testID: "surface",
					}),
				),
			);
			expect(input.animatedProps).toMatchObject({
				entering: { duration: 180, kind: "enter-surface" },
				exiting: { duration: 140, kind: "exit-surface" },
				layout: { duration: 180, kind: "layout" },
				testID: "surface",
			});
		} finally {
			root.unmount();
		}
	});

	it("does not favorite or archive on a full right swipe", () => {
		renderRow();
		input.onLayout?.({
			nativeEvent: { layout: { x: 0, y: 0, width: 300, height: 96 } },
		});
		input.onUpdate?.({ translationX: 290 });
		input.onEnd?.({ translationX: 290 });
		expect(input.onArchive).not.toHaveBeenCalled();
	});
});

function renderRow(
	disabled = false,
	primarySwipeAction?: "archive" | "organize",
) {
	const root = createRoot(document.createElement("div"));
	try {
		flushSync(() =>
			root.render(
				createElement(MobileSwipeableNoteRow, {
					note: fixtureNotes[0],
					disabled,
					children: "Note",
					actions: {
						onArchive: input.onArchive,
						onDelete: vi.fn(),
						onOrganize: input.onOrganize,
						onToggleFavorite: vi.fn(),
						primarySwipeAction,
					},
				}),
			),
		);
		return nativeSwipe.mock.calls.at(-1)?.[0] as {
			enableTrackpadTwoFingerGesture?: boolean;
			renderLeftActions?: unknown;
			renderRightActions?: unknown;
			dragOffsetFromLeftEdge?: number;
		};
	} finally {
		root.unmount();
	}
}

function setSwipeWidth() {
	input.onLayout?.({
		nativeEvent: { layout: { x: 0, y: 0, width: 300, height: 96 } },
	});
}

function beginSwipe() {
	input.onStart?.();
}

function crossSwipeThreshold() {
	input.onUpdate?.({ translationX: -290 });
}

function finishSwipe() {
	input.onEnd?.({ translationX: -290 });
	while (input.timingCallbacks.length) input.timingCallbacks.shift()?.(true);
}
