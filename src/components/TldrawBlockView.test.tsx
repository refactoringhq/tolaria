import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TldrawBlockView } from "./TldrawBlockView";

const mockWhiteboard = vi.hoisted(() =>
	vi.fn(() => <div data-testid="whiteboard-runtime" />),
);

vi.mock("./TldrawWhiteboard", () => ({ TldrawWhiteboard: mockWhiteboard }));

class MockIntersectionObserver {
	static instances: MockIntersectionObserver[] = [];
	callback: IntersectionObserverCallback;
	observe = vi.fn();
	disconnect = vi.fn();

	constructor(callback: IntersectionObserverCallback) {
		this.callback = callback;
		MockIntersectionObserver.instances.push(this);
	}

	intersect() {
		this.callback(
			[{ isIntersecting: true } as IntersectionObserverEntry],
			this as unknown as IntersectionObserver,
		);
	}
}

afterEach(() => {
	cleanup();
	MockIntersectionObserver.instances = [];
	vi.unstubAllGlobals();
	mockWhiteboard.mockClear();
});

describe("TldrawBlockView", () => {
	it("mounts the whiteboard runtime only when the block approaches the viewport", async () => {
		vi.stubGlobal("IntersectionObserver", MockIntersectionObserver);
		const { container } = render(
			<TldrawBlockView
				block={{
					id: "board-1",
					props: {
						boardId: "board-1",
						height: "520",
						width: "",
						snapshot: "{}",
					},
				}}
				editor={{} as never}
			/>,
		);

		expect(container.firstElementChild).toHaveStyle({ width: "100%" });
		expect(document.querySelector(".tldraw-whiteboard--loading")).toBeTruthy();
		expect(screen.queryByTestId("whiteboard-runtime")).toBeNull();
		expect(MockIntersectionObserver.instances).toHaveLength(1);
		expect(MockIntersectionObserver.instances[0]?.observe).toHaveBeenCalled();

		act(() => MockIntersectionObserver.instances[0]?.intersect());

		expect(await screen.findByTestId("whiteboard-runtime")).toBeTruthy();
		expect(
			MockIntersectionObserver.instances[0]?.disconnect,
		).toHaveBeenCalled();
	});
});
