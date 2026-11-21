import { describe, expect, it } from "vitest";
import { renderCollabCursor } from "./collabCursor";

describe("renderCollabCursor", () => {
	it("draws the caret and a name label in the user's colour, with BlockNote's classes", () => {
		const cursor = renderCollabCursor({
			name: "Safari · iPhone",
			color: "#1971c2",
		});

		const caret = cursor.querySelector<HTMLElement>(
			".bn-collaboration-cursor__caret",
		);
		const label = cursor.querySelector<HTMLElement>(
			".bn-collaboration-cursor__label",
		);
		expect(cursor.dataset.testid).toBe("collab-cursor");
		expect(caret?.getAttribute("contenteditable")).toBe("false");
		expect(caret?.style.backgroundColor).toBe("rgb(25, 113, 194)");
		expect(label?.style.backgroundColor).toBe("rgb(25, 113, 194)");
		expect(label?.textContent).toBe("Safari · iPhone");
	});

	it("caps the name to a phone-sized width instead of running across the line", () => {
		const name = renderCollabCursor({
			name: "A very long device name that goes on",
			color: "#1971c2",
		}).querySelector<HTMLElement>(".collab-cursor__name");

		expect(name?.style.maxWidth).toBe("9rem");
		expect(name?.style.textOverflow).toBe("ellipsis");
	});

	it("falls back to a placeholder name and a neutral colour for a malformed user", () => {
		const cursor = renderCollabCursor({
			name: "   ",
			color: "red; background: url(https://evil.test)",
		});

		expect(cursor.textContent).toContain("?");
		expect(
			cursor.querySelector<HTMLElement>(".bn-collaboration-cursor__caret")
				?.style.backgroundColor,
		).toBe("var(--accent-gray)");
	});

	it("puts the name in a text node, never parsed as markup", () => {
		const name = renderCollabCursor({
			name: "Ada",
			color: "#1971c2",
		}).querySelector(".collab-cursor__name");

		expect(name?.childNodes).toHaveLength(1);
		expect(name?.firstChild?.nodeType).toBe(Node.TEXT_NODE);
	});
});
