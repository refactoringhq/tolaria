import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

const editorElement = document.createElement("div");
document.body.append(editorElement);
const mocks = vi.hoisted(() => ({ suggestionMenuItemProps: vi.fn() }));

vi.mock("@blocknote/react", () => ({
	useBlockNoteEditor: () => ({ domElement: editorElement }),
	useComponentsContext: () => ({
		SuggestionMenu: {
			EmptyItem: ({ children }: { children?: ReactNode }) => (
				<div>{children}</div>
			),
			Item: (props: { item: { title: string }; onClick: () => void }) => {
				mocks.suggestionMenuItemProps(props);
				const { item, onClick } = props;
				return (
					<button type="button" onClick={onClick}>
						{item.title}
					</button>
				);
			},
			Label: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
			Loader: () => <div>Loading</div>,
			Root: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
		},
	}),
	useDictionary: () => ({ suggestion_menu: { no_items_title: "No items" } }),
}));

import { TolariaSlashMenu } from "./TolariaSlashMenu";
import type { TolariaSlashMenuItem } from "./tolariaEditorFormattingConfig";

function calloutItem(): TolariaSlashMenuItem {
	return {
		aliases: [],
		key: "callout",
		onItemClick: vi.fn(),
		submenuItems: [
			{ key: "callout_note", title: "Note", onItemClick: vi.fn() },
			{ key: "callout_tip", title: "Tip", onItemClick: vi.fn() },
		],
		title: "Callout",
	};
}

describe("TolariaSlashMenu", () => {
	it("passes only supported props to the BlockNote suggestion item", () => {
		render(
			<TolariaSlashMenu
				items={[calloutItem()]}
				loadingState="loaded"
				selectedIndex={0}
				onItemClick={vi.fn()}
			/>,
		);

		expect(mocks.suggestionMenuItemProps).toHaveBeenCalledWith(
			expect.not.objectContaining({ onMouseEnter: expect.anything() }),
		);
	});

	it("opens the callout type submenu on the right and selects a clicked style", () => {
		const item = calloutItem();
		const onItemClick = vi.fn();
		render(
			<TolariaSlashMenu
				items={[item]}
				loadingState="loaded"
				selectedIndex={0}
				onItemClick={onItemClick}
			/>,
		);

		fireEvent.mouseEnter(screen.getByRole("button", { name: "Callout" }));

		const submenu = screen.getByRole("menu", { name: "Callout" });
		expect(submenu).toHaveClass("tolaria-slash-menu__submenu");
		fireEvent.click(screen.getByRole("menuitem", { name: "Tip" }));
		expect(onItemClick).toHaveBeenCalledWith(item.submenuItems?.[1]);
	});

	it("keeps the submenu flush to its row and inside a small viewport", () => {
		vi.stubGlobal("innerWidth", 300);
		vi.stubGlobal("innerHeight", 600);
		vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(
			function (this: Element) {
				if (this.classList.contains("tolaria-slash-menu__submenu")) {
					return {
						x: 0,
						y: 0,
						left: 0,
						top: 0,
						right: 150,
						bottom: 240,
						width: 150,
						height: 240,
						toJSON: () => ({}),
					} as DOMRect;
				}
				return {
					x: 180,
					y: 550,
					left: 180,
					top: 550,
					right: 260,
					bottom: 580,
					width: 80,
					height: 30,
					toJSON: () => ({}),
				} as DOMRect;
			},
		);
		const item = calloutItem();
		render(
			<TolariaSlashMenu
				items={[item]}
				loadingState="loaded"
				selectedIndex={0}
				onItemClick={vi.fn()}
			/>,
		);

		fireEvent.mouseEnter(screen.getByRole("button", { name: "Callout" }));

		const submenu = screen.getByRole("menu", { name: "Callout" });
		expect(submenu).toHaveStyle({ left: "30px", top: "352px" });
		vi.restoreAllMocks();
		vi.unstubAllGlobals();
	});

	it("supports right-arrow entry and keyboard selection inside the submenu", () => {
		const item = calloutItem();
		const onItemClick = vi.fn();
		render(
			<TolariaSlashMenu
				items={[item]}
				loadingState="loaded"
				selectedIndex={0}
				onItemClick={onItemClick}
			/>,
		);

		fireEvent.keyDown(editorElement, { key: "ArrowRight" });
		fireEvent.keyDown(editorElement, { key: "ArrowDown" });
		fireEvent.keyDown(editorElement, { key: "Enter" });

		expect(onItemClick).toHaveBeenCalledWith(item.submenuItems?.[1]);
	});

	it("keeps vertical arrow keys inside an open submenu", () => {
		render(
			<TolariaSlashMenu
				items={[calloutItem()]}
				loadingState="loaded"
				selectedIndex={0}
				onItemClick={vi.fn()}
			/>,
		);
		const parentMenuKeyDown = vi.fn();
		editorElement.addEventListener("keydown", parentMenuKeyDown);

		fireEvent.keyDown(editorElement, { key: "ArrowRight" });
		fireEvent.keyDown(editorElement, { key: "ArrowDown" });

		expect(screen.getByRole("menuitem", { name: "Note" })).toHaveAttribute(
			"aria-selected",
			"false",
		);
		expect(screen.getByRole("menuitem", { name: "Tip" })).toHaveAttribute(
			"aria-selected",
			"true",
		);
		expect(parentMenuKeyDown).not.toHaveBeenCalled();
		editorElement.removeEventListener("keydown", parentMenuKeyDown);
	});

	it("handles arrow keys when focus is on a submenu item", () => {
		render(
			<TolariaSlashMenu
				items={[calloutItem()]}
				loadingState="loaded"
				selectedIndex={0}
				onItemClick={vi.fn()}
			/>,
		);
		fireEvent.keyDown(editorElement, { key: "ArrowRight" });

		fireEvent.keyDown(screen.getByRole("menuitem", { name: "Note" }), {
			key: "ArrowDown",
		});

		expect(screen.getByRole("menuitem", { name: "Tip" })).toHaveAttribute(
			"aria-selected",
			"true",
		);
	});
});
