import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { StatusBar } from "./StatusBar";

const touch = vi.hoisted(() => ({ input: false }));
vi.mock("../hooks/useTouchInput", () => ({ useTouchInput: () => touch.input }));

function renderStatusBar() {
	render(
		<StatusBar
			noteCount={10}
			vaultPath="/vault"
			vaults={[]}
			onSwitchVault={vi.fn()}
			onOpenSettings={vi.fn()}
		/>,
	);
	return screen.getByTestId("status-bar");
}

describe("StatusBar under a finger (TOL-419)", () => {
	afterEach(() => {
		touch.input = false;
	});

	it("keeps its compact 30 px row with a mouse", () => {
		expect(renderStatusBar()).toHaveStyle({
			height: "30px",
			flexWrap: "nowrap",
			padding: "0px 8px",
		});
	});

	it("grows around its 44 px targets with a finger", () => {
		touch.input = true;
		expect(renderStatusBar()).toHaveStyle({
			height: "auto",
			minHeight: "30px",
			flexWrap: "nowrap",
		});
	});
});
