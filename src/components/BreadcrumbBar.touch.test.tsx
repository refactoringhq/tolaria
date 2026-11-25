import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { installTooltipTouchGate } from "../lib/tooltipTouchGate";
import type { VaultEntry } from "../types";
import { BreadcrumbBar } from "./BreadcrumbBar";

vi.mock("../hooks/useDragRegion", () => ({
	useDragRegion: () => ({ onMouseDown: vi.fn() }),
}));

const entry = {
	path: "/vault/note/test.md",
	filename: "test.md",
	title: "Test Note",
	isA: "Note",
	hasH1: false,
	archived: false,
	favorite: false,
	organized: false,
} as VaultEntry;

function pointer(target: Element, type: string, pointerType: string): void {
	const event = new MouseEvent(type, { bubbles: true });
	Object.defineProperty(event, "pointerType", { value: pointerType });
	act(() => {
		target.dispatchEvent(event);
	});
}

function renderFavorite(): HTMLElement {
	render(
		<BreadcrumbBar
			entry={entry}
			wordCount={1}
			showDiffToggle={false}
			diffMode={false}
			diffLoading={false}
			onToggleDiff={vi.fn()}
			onToggleFavorite={vi.fn()}
		/>,
	);
	return screen.getByRole("button", { name: "Add to favorites" });
}

describe("BreadcrumbBar toolbar tooltips under a finger (TOL-419)", () => {
	let uninstall: () => void;

	beforeEach(() => {
		uninstall = installTooltipTouchGate(window);
	});
	afterEach(() => {
		uninstall();
	});

	it("opens no tooltip for a touch, nor for the focus the tap leaves behind", () => {
		const favorite = renderFavorite();
		pointer(favorite, "pointerover", "touch");
		act(() => {
			favorite.focus();
		});
		expect(screen.queryByRole("tooltip")).toBeNull();
	});

	it("still opens the tooltip when a mouse hovers the button", async () => {
		const favorite = renderFavorite();
		pointer(favorite, "pointerover", "mouse");
		expect(await screen.findByRole("tooltip")).toHaveTextContent(
			"Add to favorites",
		);
	});
});
