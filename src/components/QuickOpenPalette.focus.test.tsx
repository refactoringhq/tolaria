import { render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { QuickOpenPalette } from "./QuickOpenPalette";

it("keeps the focused search divider on the neutral border color", () => {
	render(
		<QuickOpenPalette open entries={[]} onSelect={vi.fn()} onClose={vi.fn()} />,
	);

	expect(screen.getByPlaceholderText("Search notes...")).toHaveClass(
		"border-b",
		"border-border",
		"focus-visible:border-border",
		"focus-visible:ring-0",
	);
});
