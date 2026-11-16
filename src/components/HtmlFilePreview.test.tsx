import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { isLargeTextDocument } from "../utils/largeTextDocument";
import { HtmlFilePreview } from "./HtmlFilePreview";

vi.mock("@tauri-apps/api/core", () => ({
	convertFileSrc: (path: string) => `asset://${path}`,
}));

describe("HtmlFilePreview", () => {
	const props = {
		path: "/vault/report.html",
		title: "Report",
		vaultPath: "/vault",
	};

	it("keeps the sandboxed preview for ordinary HTML", () => {
		const content = `${String.fromCharCode(60)}h1>Report${String.fromCharCode(60)}/h1>`;
		render(<HtmlFilePreview {...props} content={content} />);
		expect(screen.getByTestId("html-file-preview")).toHaveAttribute(
			"sandbox",
			"allow-popups allow-popups-to-escape-sandbox",
		);
	});

	it("shows a fallback without parsing extremely long HTML lines", () => {
		render(
			<HtmlFilePreview
				{...props}
				content={`<pre>${"x".repeat(800_000)}</pre>`}
			/>,
		);
		expect(screen.getByTestId("large-document-fallback")).toBeInTheDocument();
		expect(screen.queryByTestId("html-file-preview")).not.toBeInTheDocument();
	});
});

describe("large text document guard", () => {
	it("allows ordinary text and bounded lines", () => {
		expect(isLargeTextDocument("Small document\nwith multiple lines")).toBe(
			false,
		);
		expect(
			isLargeTextDocument(`${"a".repeat(99_999)}\n${"b".repeat(99_999)}`),
		).toBe(false);
	});

	it("limits one-megabyte documents and extremely long lines", () => {
		expect(isLargeTextDocument("a".repeat(1_000_000))).toBe(true);
		expect(isLargeTextDocument("a".repeat(100_000))).toBe(true);
	});
});
