import { beforeEach, expect, it, vi } from "vitest";

const disk = vi.hoisted(() => ({
	copy: vi.fn(),
	mkdir: vi.fn(),
	remove: vi.fn(),
	write: vi.fn(),
}));
vi.mock("expo-crypto", () => ({ randomUUID: () => "preview-session" }));
vi.mock("expo-file-system/legacy", () => ({
	cacheDirectory: "file:///application/Cache/",
	copyAsync: disk.copy,
	makeDirectoryAsync: disk.mkdir,
	deleteAsync: disk.remove,
	writeAsStringAsync: disk.write,
}));
vi.mock("./MobileWysiwygTentapEditorHtml", () => ({
	mobileWysiwygTentapEditorHtml:
		'<html><head></head><body><div id="root"></div></body></html>',
}));

beforeEach(() => {
	vi.resetModules();
	for (const fn of Object.values(disk))
		fn.mockReset().mockResolvedValue(undefined);
});

it("stages only referenced images beside the editor shell, without writing into the vault", async () => {
	const { createMobileEditorPreview } = await import(
		"./mobileEditorFileSource.native"
	);
	const preview = createMobileEditorPreview("file:///vault/");
	await preview.prepare(
		"# Note\n![one](attachments/a.png)\n![same](attachments/a.png)\n![nested](<attachments/nested/b c.png>)",
	);
	expect(disk.copy).toHaveBeenCalledWith({
		from: "file:///vault/attachments/a.png",
		to: `${preview.rootUri}attachments/a.png`,
	});
	expect(disk.copy).toHaveBeenCalledWith({
		from: "file:///vault/attachments/nested/b%20c.png",
		to: `${preview.rootUri}attachments/nested/b%20c.png`,
	});
	expect(disk.copy).toHaveBeenCalledTimes(3);
	expect(disk.write).toHaveBeenCalledExactlyOnceWith(
		"file:///application/Cache/tolaria-editor-previews/editor-preview-session.html",
		'<html><head></head><body><div id="root"></div></body></html>',
	);
	await preview.prepare("![one](attachments/a.png)");
	expect(disk.copy).toHaveBeenCalledTimes(3);
	await preview.dispose();
	expect(disk.remove).toHaveBeenLastCalledWith(preview.rootUri, {
		idempotent: true,
	});
});

it("rejects outside-vault paths and does not fetch remote images or copy linked documents", async () => {
	const { createMobileEditorPreview } = await import(
		"./mobileEditorFileSource.native"
	);
	const preview = createMobileEditorPreview("file:///vault/");
	await preview.prepare(
		"![a](attachments/../secret.png) ![b](file:///other/private.png) ![c](https://example.com/i.png) [doc](attachments/big.pdf)",
	);
	expect(disk.copy).toHaveBeenCalledTimes(1);
});

it("keeps the editor usable when an attachment is missing and retries on a later preparation", async () => {
	const { createMobileEditorPreview } = await import(
		"./mobileEditorFileSource.native"
	);
	const preview = createMobileEditorPreview("file:///vault/");
	disk.copy.mockImplementation(async ({ from }: { from: string }) => {
		if (from.includes("/vault/")) throw new Error("missing image");
	});
	await expect(
		preview.prepare("![one](attachments/a.png)"),
	).resolves.toBeUndefined();
	disk.copy.mockResolvedValue(undefined);
	await preview.prepare("![one](attachments/a.png)");
	expect(disk.copy).toHaveBeenCalledTimes(3);
});

it("waits for pending copies before deleting its own preview directory", async () => {
	const { createMobileEditorPreview } = await import(
		"./mobileEditorFileSource.native"
	);
	const preview = createMobileEditorPreview("file:///vault/");
	let finish: () => void = () => undefined;
	disk.write.mockReturnValueOnce(
		new Promise<void>((resolve) => {
			finish = resolve;
		}),
	);
	const pending = preview.prepare("![one](attachments/a.png)");
	const disposed = preview.dispose();
	expect(disk.remove).not.toHaveBeenCalled();
	finish();
	await pending;
	await disposed;
	expect(disk.remove).toHaveBeenLastCalledWith(preview.rootUri, {
		idempotent: true,
	});
	await expect(
		preview.prepare("![late](attachments/late.png)"),
	).rejects.toThrow("disposed");
});

it("permits only the cached shell to navigate and scopes reads to that preview", async () => {
	const { createMobileEditorPreview, mobileEditorFileWebViewProps } =
		await import("./mobileEditorFileSource.native");
	const preview = createMobileEditorPreview("file:///vault/");
	const props = mobileEditorFileWebViewProps(preview);
	expect(props.allowingReadAccessToURL).toBe(preview.rootUri);
	expect(props.allowUniversalAccessFromFileURLs).toBe(false);
	expect(props.onShouldStartLoadWithRequest({ url: preview.source.uri })).toBe(
		true,
	);
	expect(props.onShouldStartLoadWithRequest({ url: "about:blank" })).toBe(true);
	for (const url of [
		"file:///vault/note.html",
		"https://example.com",
		"javascript:alert(1)",
	]) {
		expect(props.onShouldStartLoadWithRequest({ url })).toBe(false);
	}
});

it("keeps image URLs portable in the editor document while resolving attachment links to the vault", async () => {
	const { mobileEditorPreviewHtml } = await import(
		"./mobileEditorFileSource.native"
	);
	const html = mobileEditorPreviewHtml(
		"![Photo](<attachments/b & c.png>)\n\n[PDF](attachments/a.pdf)",
		"file:///vault/",
	);
	expect(html).toContain('src="attachments/b &amp; c.png"');
	expect(html).toContain('href="file:///vault/attachments/a.pdf"');
});

it("embeds the final appearance stylesheet into the local shell before the WebView loads", async () => {
	const { createMobileEditorPreview } = await import(
		"./mobileEditorFileSource.native"
	);
	const preview = createMobileEditorPreview("file:///vault/", {
		css: "#root { visibility: visible; }",
	});

	await preview.prepare("");

	expect(disk.write).toHaveBeenCalledWith(
		"file:///application/Cache/tolaria-editor-previews/editor-preview-session.html",
		'<html><head><style data-tag="tolaria-editor-appearance">#root { visibility: visible; }</style></head><body><div id="root"></div></body></html>',
	);
	expect(disk.copy).toHaveBeenCalledWith({
		from: "file:///application/Cache/tolaria-editor-previews/editor-preview-session.html",
		to: preview.source.uri,
	});
});

it("cleans previews abandoned by a previous process only once, before staging any new preview", async () => {
	const { createMobileEditorPreview } = await import(
		"./mobileEditorFileSource.native"
	);
	const first = createMobileEditorPreview("file:///vault/");
	const second = createMobileEditorPreview("file:///other-vault/");
	await first.prepare("");
	await second.prepare("");
	expect(disk.remove).toHaveBeenCalledExactlyOnceWith(
		"file:///application/Cache/tolaria-editor-previews/",
		{ idempotent: true },
	);
	expect(disk.remove.mock.invocationCallOrder[0]).toBeLessThan(
		disk.copy.mock.invocationCallOrder[0],
	);
});
