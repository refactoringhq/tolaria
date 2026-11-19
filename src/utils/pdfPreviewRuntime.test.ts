import { beforeEach, describe, expect, it, vi } from "vitest";
import { loadPdfDocument } from "./pdfPreviewRuntime";

const { getDocumentMock } = vi.hoisted(() => ({ getDocumentMock: vi.fn() }));

vi.mock("pdfjs-dist/build/pdf.worker.min.mjs?url", () => ({
	default: "/pdf.worker.js",
}));
vi.mock("pdfjs-dist", () => ({
	GlobalWorkerOptions: {},
	getDocument: getDocumentMock,
}));

describe("loadPdfDocument", () => {
	beforeEach(() => {
		getDocumentMock.mockReset();
		getDocumentMock.mockReturnValue({
			destroy: vi.fn(),
			promise: Promise.resolve({ getPage: vi.fn(), numPages: 3 }),
		});
	});

	it.each([
		"asset://localhost/vault/report.pdf",
		"http://asset.localhost/vault/report.pdf",
		"https://asset.localhost/vault/report.pdf",
		`blob:${window.location.origin}/123`,
	])("loads %s", async (source) => {
		const document = await loadPdfDocument(source);
		expect(getDocumentMock).toHaveBeenCalledWith({ url: source });
		expect(document.numPages).toBe(3);
	});

	it.each([
		"file:///etc/report.pdf",
		"javascript:alert(1)",
		"https://example.com/report.pdf",
		"http://evil.localhost/report.pdf",
		"data:application/pdf;base64,JVBERi0xLjQK",
		"blob:https://example.com/123",
		"/vault/report.pdf",
		"http://[",
		"asset://evil.example/report.pdf",
		"asset:report.pdf",
		"asset://user@localhost/report.pdf",
		"asset://localhost:8080/report.pdf",
		"http://user@asset.localhost/report.pdf",
	])("rejects %s without fetching it", async (source) => {
		await expect(loadPdfDocument(source)).rejects.toThrow(
			"Unsupported PDF source",
		);
		expect(getDocumentMock).not.toHaveBeenCalled();
	});
});
