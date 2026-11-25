import { EventEmitter } from "node:events";
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { findRichEditorMatches } from "./richEditorFind";
import {
	useDocumentRevision,
	useFindResults,
} from "./useRichEditorFindController";

vi.mock("./richEditorFind", async (importOriginal) => {
	const actual = await importOriginal<typeof import("./richEditorFind")>();
	return {
		...actual,
		findRichEditorMatches: vi.fn(() => ({ matches: [], error: null })),
		selectRichEditorFindMatch: vi.fn(),
		setRichEditorFindMatches: vi.fn(),
	};
});

const options = { caseSensitive: false, regex: false };

function createEditor() {
	const events = new EventEmitter();
	return {
		on: events.on.bind(events),
		off: events.off.bind(events),
		emit: events.emit.bind(events),
		state: { doc: {} },
		type: "test editor",
	};
}

describe("rich editor find while closed", () => {
	beforeEach(() => vi.mocked(findRichEditorMatches).mockClear());

	it("does not scan or rerender for 20 document edits, then resumes scans when opened", () => {
		const editor = createEditor();
		let renders = 0;
		const hook = renderHook(
			({ open }: { open: boolean }) => {
				renders += 1;
				useDocumentRevision(editor as never, open);
				return useFindResults({
					editor: editor as never,
					open,
					query: "match",
					options,
					activeIndex: 0,
				});
			},
			{ initialProps: { open: true } },
		);
		expect(findRichEditorMatches).toHaveBeenCalledTimes(1);
		vi.mocked(findRichEditorMatches).mockClear();
		hook.rerender({ open: false });
		vi.mocked(findRichEditorMatches).mockClear();
		const closedRenders = renders;

		for (let index = 0; index < 20; index += 1) {
			act(() => {
				editor.state.doc = { index };
				editor.emit("transaction", { transaction: { docChanged: true } });
			});
		}

		expect(findRichEditorMatches).not.toHaveBeenCalled();
		expect(renders).toBe(closedRenders);

		hook.rerender({ open: true });
		expect(findRichEditorMatches).toHaveBeenCalledTimes(1);
		act(() => {
			editor.state.doc = { changed: true };
			editor.emit("transaction", { transaction: { docChanged: true } });
		});
		expect(findRichEditorMatches).toHaveBeenCalledTimes(2);
		hook.unmount();
	});
});
