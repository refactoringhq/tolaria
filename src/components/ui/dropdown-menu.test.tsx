import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
	DropdownMenu,
	DropdownMenuCheckboxItem,
	DropdownMenuContent,
	DropdownMenuRadioGroup,
	DropdownMenuRadioItem,
	DropdownMenuTrigger,
} from "./dropdown-menu";

function renderMenu() {
	render(
		<DropdownMenu open>
			<DropdownMenuTrigger>Open</DropdownMenuTrigger>
			<DropdownMenuContent>
				<DropdownMenuRadioGroup value="list">
					<DropdownMenuRadioItem value="list">List</DropdownMenuRadioItem>
					<DropdownMenuRadioItem value="board">Board</DropdownMenuRadioItem>
				</DropdownMenuRadioGroup>
				<DropdownMenuCheckboxItem checked>Weekends</DropdownMenuCheckboxItem>
				<DropdownMenuCheckboxItem checked={false}>
					Icons
				</DropdownMenuCheckboxItem>
			</DropdownMenuContent>
		</DropdownMenu>,
	);
}

function indicatorOf(item: HTMLElement) {
	return item.querySelector('[data-slot="dropdown-menu-item-indicator"]');
}

function glyphPathOf(item: HTMLElement) {
	return indicatorOf(item)?.querySelector("path")?.getAttribute("d");
}

describe("dropdown menu selectable items", () => {
	it("keeps labels flush left and puts the indicator after the label", () => {
		renderMenu();
		for (const item of [
			...screen.getAllByRole("menuitemradio"),
			...screen.getAllByRole("menuitemcheckbox"),
		]) {
			expect(item.className).not.toContain("pl-8");
			expect(item.className).toContain("px-2");
			expect(item.lastElementChild).toBe(indicatorOf(item));
			expect(indicatorOf(item)?.className).not.toContain("left-2");
		}
	});

	it("shows a check mark only on selected items, never a circle", () => {
		renderMenu();
		const [list, board] = screen.getAllByRole("menuitemradio");
		const [weekends, icons] = screen.getAllByRole("menuitemcheckbox");

		expect(list).toHaveAttribute("aria-checked", "true");
		expect(board).toHaveAttribute("aria-checked", "false");
		expect(indicatorOf(list)?.querySelector("svg")).not.toBeNull();
		expect(indicatorOf(board)?.querySelector("svg")).toBeNull();
		expect(indicatorOf(weekends)?.querySelector("svg")).not.toBeNull();
		expect(indicatorOf(icons)?.querySelector("svg")).toBeNull();
		expect(glyphPathOf(list)).toBe(glyphPathOf(weekends));
	});
});
