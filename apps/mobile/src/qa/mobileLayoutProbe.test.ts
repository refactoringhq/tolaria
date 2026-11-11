// @vitest-environment jsdom
import { act, createElement, useEffect } from "react";
import { createRoot } from "react-dom/client";
import type { LayoutChangeEvent } from "react-native";
import { afterEach, expect, it, vi } from "vitest";
import type { MobileLayoutMetric } from "./mobileLayoutProbe";
import { useMobileLayoutProbe } from "./mobileLayoutProbe";

vi.mock("./mobileMotionFrameLog", () => ({
	mobileMotionFrameProbeEnabled: true,
}));
vi.mock("./nativeQaSink", () => ({
	postNativeQaEvent: vi.fn(),
	setNativeQaSinkUrl: vi.fn(),
}));
vi.mock("react-native", () => ({ Platform: { OS: "ios" } }));

let root: ReturnType<typeof createRoot> | undefined;
afterEach(async () => {
	await act(async () => root?.unmount());
	root = undefined;
	delete (
		globalThis as typeof globalThis & {
			__TOLARIA_MOBILE_LAYOUT_METRICS__?: Record<string, MobileLayoutMetric>;
		}
	).__TOLARIA_MOBILE_LAYOUT_METRICS__;
});

it("publishes layout metrics without rerendering the motion-probed screen", async () => {
	const host = document.createElement("div");
	const onRendered = vi.fn();
	let recordLayout: ((event: LayoutChangeEvent) => void) | undefined;
	const onProbeReady = (onLayout: (event: LayoutChangeEvent) => void) => {
		recordLayout = onLayout;
	};

	function ProbeScreen() {
		const layoutProbe = useMobileLayoutProbe(true);
		const onLayout = layoutProbe.probe("editor.body").onLayout;
		useEffect(() => {
			onRendered();
			onProbeReady(onLayout);
		});
		return createElement("div");
	}

	root = createRoot(host);
	await act(async () => root?.render(createElement(ProbeScreen)));
	const rendersBeforeLayout = onRendered.mock.calls.length;
	await act(async () =>
		recordLayout?.(layoutEvent({ x: 0, y: 20, width: 400, height: 700 })),
	);

	expect(onRendered).toHaveBeenCalledTimes(rendersBeforeLayout);
	expect(
		(
			globalThis as typeof globalThis & {
				__TOLARIA_MOBILE_LAYOUT_METRICS__?: Record<string, MobileLayoutMetric>;
			}
		).__TOLARIA_MOBILE_LAYOUT_METRICS__?.["editor.body"],
	).toMatchObject({
		id: "editor.body",
		x: 0,
		y: 20,
		width: 400,
		height: 700,
	});
});

function layoutEvent(
	layout: LayoutChangeEvent["nativeEvent"]["layout"],
): LayoutChangeEvent {
	return { nativeEvent: { layout } } as LayoutChangeEvent;
}
