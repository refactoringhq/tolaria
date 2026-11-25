import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { installTooltipTouchGate } from "@/lib/tooltipTouchGate";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "./tooltip";

function touchDown(): void {
	const event = new MouseEvent("pointerdown", { bubbles: true });
	Object.defineProperty(event, "pointerType", { value: "touch" });
	document.body.dispatchEvent(event);
}

function FavoriteAction({
	onOpenChange,
	defaultOpen,
}: {
	onOpenChange?: (open: boolean) => void;
	defaultOpen?: boolean;
}) {
	return (
		<TooltipProvider>
			<Tooltip onOpenChange={onOpenChange} defaultOpen={defaultOpen}>
				<TooltipTrigger asChild>
					<button type="button">Favorite</button>
				</TooltipTrigger>
				<TooltipContent>Add to favorites</TooltipContent>
			</Tooltip>
		</TooltipProvider>
	);
}

function focusTrigger(): void {
	act(() => {
		screen.getByRole("button", { name: "Favorite" }).focus();
	});
}

describe("Tooltip under a finger (TOL-419)", () => {
	let uninstall: () => void;

	beforeEach(() => {
		uninstall = installTooltipTouchGate(window);
	});
	afterEach(() => {
		uninstall();
	});

	it("opens on focus while no finger was used", () => {
		const onOpenChange = vi.fn();
		render(<FavoriteAction onOpenChange={onOpenChange} />);
		focusTrigger();
		expect(screen.getByRole("tooltip")).toHaveTextContent("Add to favorites");
		expect(onOpenChange).toHaveBeenLastCalledWith(true);
	});

	it("stays closed on the focus a tap leaves behind", () => {
		const onOpenChange = vi.fn();
		render(<FavoriteAction onOpenChange={onOpenChange} />);
		touchDown();
		focusTrigger();
		expect(screen.queryByRole("tooltip")).toBeNull();
		expect(onOpenChange).not.toHaveBeenCalled();
	});

	it("still closes a tooltip that was open", () => {
		const onOpenChange = vi.fn();
		render(<FavoriteAction onOpenChange={onOpenChange} defaultOpen />);
		expect(screen.getByRole("tooltip")).toBeInTheDocument();
		touchDown();
		fireEvent.keyDown(document, { key: "Escape" });
		expect(screen.queryByRole("tooltip")).toBeNull();
		expect(onOpenChange).toHaveBeenLastCalledWith(false);
	});
});

function OwnedTooltip({ open }: { open: boolean }) {
	return (
		<TooltipProvider>
			<Tooltip open={open}>
				<TooltipTrigger asChild>
					<button type="button">Raw editor</button>
				</TooltipTrigger>
				<TooltipContent>Open the raw editor</TooltipContent>
			</Tooltip>
		</TooltipProvider>
	);
}

describe("Tooltip opened by its owner under a finger (TOL-419)", () => {
	let uninstall: () => void;

	beforeEach(() => {
		uninstall = installTooltipTouchGate(window);
	});
	afterEach(() => {
		uninstall();
	});

	it("shows an owner-opened tooltip while no finger was used", () => {
		const { rerender } = render(<OwnedTooltip open={false} />);
		rerender(<OwnedTooltip open />);
		expect(screen.getByRole("tooltip")).toHaveTextContent(
			"Open the raw editor",
		);
	});

	it("keeps an owner-opened tooltip hidden when a tap opened it, until it opens again", () => {
		const { rerender } = render(<OwnedTooltip open={false} />);
		touchDown();
		rerender(<OwnedTooltip open />);
		expect(screen.queryByRole("tooltip")).toBeNull();

		rerender(<OwnedTooltip open={false} />);
		const move = new MouseEvent("pointermove", { bubbles: true });
		Object.defineProperty(move, "pointerType", { value: "mouse" });
		document.body.dispatchEvent(move);
		rerender(<OwnedTooltip open />);
		expect(screen.getByRole("tooltip")).toBeInTheDocument();
	});
});
