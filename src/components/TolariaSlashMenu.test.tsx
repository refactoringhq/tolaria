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

	it("does not open the submenu for key presses outside the editor", () => {
		render(
			<TolariaSlashMenu
				items={[calloutItem()]}
				loadingState="loaded"
				selectedIndex={0}
				onItemClick={vi.fn()}
			/>,
		);

		fireEvent.keyDown(document, { key: "ArrowRight" });

		expect(
			screen.queryByRole("menu", { name: "Callout" }),
		).not.toBeInTheDocument();
	});
});
