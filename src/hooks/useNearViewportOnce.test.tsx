import { act, render, screen } from "@testing-library/react";
import { useRef } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useNearViewportOnce } from "./useNearViewportOnce";

class MockIntersectionObserver {
	static instances: MockIntersectionObserver[] = [];
	disconnect = vi.fn();
	observe = vi.fn();

	constructor(
		readonly callback: IntersectionObserverCallback,
		readonly options?: IntersectionObserverInit,
	) {
		MockIntersectionObserver.instances.push(this);
	}

	report(isIntersecting: boolean) {
		this.callback(
			[{ isIntersecting } as IntersectionObserverEntry],
			this as unknown as IntersectionObserver,
		);
	}
}

function Probe({ eager }: { eager?: boolean }) {
	const ref = useRef<HTMLDivElement>(null);
	const near = useNearViewportOnce(ref, { eager });
	return <div ref={ref}>{near ? "near" : "far"}</div>;
}

function latestObserver(): MockIntersectionObserver | undefined {
	return MockIntersectionObserver.instances.at(-1);
}

describe("useNearViewportOnce", () => {
	beforeEach(() => {
		MockIntersectionObserver.instances = [];
		vi.stubGlobal("IntersectionObserver", MockIntersectionObserver);
	});

	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it("stays far until the element comes within 600px of the viewport, then disconnects", () => {
		render(<Probe />);
		expect(screen.getByText("far")).toBeInTheDocument();
		expect(latestObserver()?.options).toEqual({ rootMargin: "600px 0px" });
		expect(latestObserver()?.observe).toHaveBeenCalledWith(
			screen.getByText("far"),
		);

		act(() => latestObserver()?.report(false));
		expect(screen.getByText("far")).toBeInTheDocument();

		act(() => latestObserver()?.report(true));
		expect(screen.getByText("near")).toBeInTheDocument();
		expect(latestObserver()?.disconnect).toHaveBeenCalled();
	});

	it("renders eagerly without observing when eager is set", () => {
		render(<Probe eager />);
		expect(screen.getByText("near")).toBeInTheDocument();
		expect(MockIntersectionObserver.instances).toHaveLength(0);
	});

	it("renders eagerly when IntersectionObserver is unavailable", () => {
		vi.stubGlobal("IntersectionObserver", undefined);
		render(<Probe />);
		expect(screen.getByText("near")).toBeInTheDocument();
	});

	it("disconnects the observer on unmount", () => {
		const { unmount } = render(<Probe />);
		const observer = latestObserver();
		unmount();
		expect(observer?.disconnect).toHaveBeenCalled();
	});
});
