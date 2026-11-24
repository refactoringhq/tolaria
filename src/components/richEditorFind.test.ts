import { Schema } from "@tiptap/pm/model";
import { describe, expect, it } from "vitest";
import {
	findRichEditorMatches,
	shouldKeepFindInEditorMode,
	shouldSwitchFindToRaw,
} from "./richEditorFind";

const schema = new Schema({
	nodes: {
		doc: { content: "block+" },
		paragraph: { content: "text*", group: "block" },
		text: { group: "inline" },
	},
	marks: { bold: {} },
});

describe("findRichEditorMatches", () => {
	it("finds every match across rich text mark boundaries with document positions", () => {
		const doc = schema.node("doc", null, [
			schema.node("paragraph", null, [
				schema.text("Find ", [schema.mark("bold")]),
				schema.text("here, then find here"),
			]),
		]);

		expect(
			findRichEditorMatches(doc, "find", {
				caseSensitive: false,
				regex: false,
			}),
		).toEqual({
			error: null,
			matches: [
				{ from: 1, to: 5, text: "Find" },
				{ from: 17, to: 21, text: "find" },
			],
		});
	});
});

describe("rich editor find mode", () => {
	it("keeps desktop rich mode and preserves the existing web and raw mode behavior", () => {
		expect(shouldKeepFindInEditorMode(true, false)).toBe(true);
		expect(shouldSwitchFindToRaw(true, false)).toBe(false);
		expect(shouldKeepFindInEditorMode(true, true)).toBe(false);
		expect(shouldSwitchFindToRaw(true, true)).toBe(false);
		expect(shouldKeepFindInEditorMode(false, false)).toBe(false);
		expect(shouldSwitchFindToRaw(false, false)).toBe(true);
	});
});
