import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { RawEditorView } from "./RawEditorView";

describe("RawEditorView large documents", () => {
	it("shows a fallback instead of mounting CodeMirror for a huge single line", () => {
		render(
			<RawEditorView
				content={`<pre>${"x".repeat(800_000)}</pre>`}
				path="/vault/report.html"
				entries={[]}
				onContentChange={() => {}}
				onSave={() => {}}
			/>,
		);
		expect(screen.getByTestId("large-document-fallback")).toBeInTheDocument();
		expect(
			screen.queryByTestId("raw-editor-codemirror"),
		).not.toBeInTheDocument();
	});
});
