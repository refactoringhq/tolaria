// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import {
	mobileDocumentBody,
	mobileDocumentWithBody,
	mobileMarkdownBodyToTentapHtml,
	tiptapJsonToMobileMarkdown,
} from "../../workspace/mobileDocumentContent";
import { mobileWikilinkHref } from "../../workspace/mobileWikilinks";
import { createTestTentapEditor } from "./MobileTentapTestHarness";
import { nativeWysiwygDocumentContentFromJson } from "./MobileWysiwygDocumentSerialization";
import { nativeWysiwygDocumentWithInsertedWikilink } from "./MobileWysiwygWikilinkBridgeModel";

const disposals: Array<() => void> = [];
const gettingStartedNotes = [
	`---\ntype: Note\nrelated_to: "[[tolaria]]"\n---\n# Note List\n\nYou can also create a new note anywhere with \`Cmd+N\` (\`Ctrl+N\` on Windows and Linux) or from the [[command-palette]]`,
	`---\ntype: Note\nrelated_to: "[[tolaria]]"\n---\n# Editor\n\nOpen [[editor-playground]] for examples you can manipulate directly.\n\n- List **item** 1\n  - Nested *italic item*\n\n1. **Numbered item** in bold\n2. Numbered second item\n\n- [ ] Task 1\n\nUse the export button, or run Export from the [[command-palette]], to turn the current note into a PDF.`,
	`---\ntype: Project\nstatus: In progress\nrelated_to:\n  - "[[tolaria]]"\n_organized: true\n---\n# Get familiar with Tolaria\n\n- [ ] **Read the** [[tolaria-principles|Tolaria Principles]] — understand the core philosophy\n- [ ] **Explore the** [[tolaria-sidebar]] — learn Inbox, All Notes, Archive, Favorites, Types, Folders\n- [ ] **Try the** [[tolaria-editor|Editor]] and [[editor-playground]] — rich vs raw mode\n- [ ] **Open the** [[the-properties-panel|Properties Panel]] — add a property, create a relationship`,
	`---\ntype: Note\nrelated_to: "[[tolaria]]"\n---\n# Principles\n\nTolaria is free and [open source](https://github.com/refactoringhq/tolaria). I built this for myself ([[luca-rossi]]) and for sharing it with others.\n\nA lot of how we designed [[tolaria-editor]] and [[command-palette]] is based on this.`,
];

function wikilinks(content: string) {
	return content.match(/\[\[[^\]]+\]\]/gu) ?? [];
}

function serialize(
	content: string,
	json: ReturnType<Awaited<ReturnType<typeof openNote>>["getJSON"]>,
	first = false,
) {
	return nativeWysiwygDocumentContentFromJson({
		currentContent: content,
		initialBodyHasContent: mobileDocumentBody(content).trim().length > 0,
		isFirstSerialization: first,
		json,
	}).content;
}

async function openNote(content: string) {
	const mounted = await createTestTentapEditor(
		mobileMarkdownBodyToTentapHtml(mobileDocumentBody(content)),
	);
	disposals.push(mounted.dispose);
	return mounted.editor;
}

afterEach(async () => {
	for (const dispose of disposals.splice(0)) dispose();
	await new Promise((resolve) => setTimeout(resolve, 25));
});

describe("native wikilink persistence", () => {
	it.each(["Projects/Launch", "A note with spaces"])(
		"preserves %s and its alias after reopening",
		async (target) => {
			const source =
				"---\ntype: Note\ncustom: preserved\n---\n\n# First note\n\n";
			const editor = await openNote(source);
			const json = nativeWysiwygDocumentWithInsertedWikilink({
				json: editor.getJSON(),
				payload: { target, label: "Linked note" },
			});
			expect(json).not.toBeNull();
			if (!json) throw new Error("Wikilink insertion failed");
			editor.commands.setContent(editor.schema.nodeFromJSON(json));
			expect(editor.getHTML()).toContain(mobileWikilinkHref(target));
			const saved = mobileDocumentWithBody(
				source,
				tiptapJsonToMobileMarkdown(editor.getJSON()),
			);
			expect(saved).toContain(`[[${target}|Linked note]]`);
			expect(saved).toContain("custom: preserved");
			const reopened = await openNote(saved);
			expect(tiptapJsonToMobileMarkdown(reopened.getJSON())).toContain(
				`[[${target}|Linked note]]`,
			);
			expect(reopened.getHTML()).toContain(mobileWikilinkHref(target));
		},
	);

	it("loads existing wikilinks without dropping their link marks", async () => {
		const editor = await openNote("See [[Projects/Launch|Launch plan]].");
		expect(tiptapJsonToMobileMarkdown(editor.getJSON())).toBe(
			"See [[Projects/Launch|Launch plan]].",
		);
	});

	it("preserves Getting Started wikilinks through an unrelated edit, save, and reopen", async () => {
		for (const source of gettingStartedNotes) {
			const originalLinks = wikilinks(source);
			const editor = await openNote(source);
			const initial = serialize(source, editor.getJSON(), true);
			expect(wikilinks(initial)).toEqual(originalLinks);
			editor.commands.setTextSelection(1);
			editor.commands.insertContent(" Mobile edit.");

			const saved = serialize(initial, editor.getJSON());
			expect(wikilinks(saved)).toEqual(originalLinks);
			const reopened = await openNote(saved);
			expect(wikilinks(serialize(saved, reopened.getJSON()))).toEqual(
				originalLinks,
			);
		}
	});

	it.each([
		"javascript:alert(1)",
		"data:text/html,unsafe",
		"tolaria://settings",
	])("still rejects unsafe %s links", async (href) => {
		const { editor, dispose } = await createTestTentapEditor(
			`<p><a href="${href}">Unsafe</a></p>`,
		);
		disposals.push(dispose);
		expect(editor.getHTML()).toBe("<p>Unsafe</p>");
	});
});
