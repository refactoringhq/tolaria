import { safeColor, safeName } from "../../packages/collab-client/src/presence";

/**
 * Another person's caret in a live note, drawn by BlockNote's collaboration cursors. It keeps
 * BlockNote's classes, so the name label still opens while that person is active and folds
 * back to the caret after; on top of that the name is capped to a phone-sized width, so a
 * label never runs across the line it sits above.
 */

interface CursorUser {
	name?: unknown;
	color?: unknown;
}

const WORD_JOINER = "⁠";
const LABEL_MAX_WIDTH = "9rem";
const FALLBACK_COLOR = "var(--accent-gray)";

function element(tag: string, className: string): HTMLElement {
	const created = document.createElement(tag);
	created.className = className;
	return created;
}

function nameLabel(name: string, color: string): HTMLElement {
	const label = element("span", "bn-collaboration-cursor__label");
	label.style.backgroundColor = color;
	label.style.color = "var(--text-on-fill)";
	const shortened = element("span", "collab-cursor__name");
	Object.assign(shortened.style, {
		display: "inline-block",
		maxWidth: LABEL_MAX_WIDTH,
		overflow: "hidden",
		textOverflow: "ellipsis",
		verticalAlign: "bottom",
	});
	shortened.textContent = name;
	label.append(shortened);
	return label;
}

/** The caret and name label of one remote user, as BlockNote's `renderCursor` option. */
export function renderCollabCursor(user: CursorUser): HTMLElement {
	const name = safeName(user.name);
	const base = element("span", "bn-collaboration-cursor__base");
	base.dataset.testid = "collab-cursor";
	const caret = element("span", "bn-collaboration-cursor__caret");
	caret.setAttribute("contenteditable", "false");
	// A peer's colour is used only when it is a plain `#rrggbb`.
	const color = safeColor(user.color) ?? FALLBACK_COLOR;
	caret.style.backgroundColor = color;
	caret.append(nameLabel(name, color));
	base.append(WORD_JOINER, caret, WORD_JOINER);
	return base;
}
