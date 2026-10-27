import { render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "./tooltip";

describe("tooltip positioning at non-100% zoom", () => {
	beforeEach(() => {
		document.documentElement.style.removeProperty("zoom");
		document.documentElement.style.removeProperty(
			"--tolaria-overlay-zoom-factor",
		);
		document.documentElement.style.removeProperty(
			"--tolaria-overlay-zoom-inverse",
		);
	});

	afterEach(() => {
		document.documentElement.style.removeProperty("zoom");
		document.documentElement.style.removeProperty(
			"--tolaria-overlay-zoom-factor",
		);
		document.documentElement.style.removeProperty(
			"--tolaria-overlay-zoom-inverse",
		);
	});

	for (const zoom of [80, 90, 110, 125, 150]) {
		it(`renders tooltip with zoom factor ${zoom}%`, () => {
			document.documentElement.style.setProperty("zoom", `${zoom}%`);
			document.documentElement.style.setProperty(
				"--tolaria-overlay-zoom-factor",
				String(zoom / 100),
			);
			document.documentElement.style.setProperty(
				"--tolaria-overlay-zoom-inverse",
				String(100 / zoom),
			);

			const { container } = render(
				<TooltipProvider>
					<Tooltip defaultOpen>
						<TooltipTrigger asChild>
							<button type="button">Test Button</button>
						</TooltipTrigger>
						<TooltipContent>Test Tooltip</TooltipContent>
					</Tooltip>
				</TooltipProvider>,
			);

			expect(container).toBeTruthy();
			expect(
				document.querySelector('[data-slot="tooltip-content"]'),
			).toHaveClass("z-[1400]");
		});
	}

	it("renders tooltip at 100% zoom", () => {
		document.documentElement.style.setProperty("zoom", "100%");
		document.documentElement.style.setProperty(
			"--tolaria-overlay-zoom-factor",
			"1",
		);
		document.documentElement.style.setProperty(
			"--tolaria-overlay-zoom-inverse",
			"1",
		);

		const { container } = render(
			<TooltipProvider>
				<Tooltip defaultOpen>
					<TooltipTrigger asChild>
						<button type="button">Test Button</button>
					</TooltipTrigger>
					<TooltipContent>Test Tooltip</TooltipContent>
				</Tooltip>
			</TooltipProvider>,
		);

		expect(container).toBeTruthy();
	});
});
