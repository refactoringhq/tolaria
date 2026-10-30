import { randomUUID } from "expo-crypto";
import {
	cacheDirectory,
	copyAsync,
	deleteAsync,
	makeDirectoryAsync,
	writeAsStringAsync,
} from "expo-file-system/legacy";
import { useEffect, useState } from "react";
import {
	mobileAttachmentUriForHref,
	mobileHtmlWithResolvedAttachmentUris,
	mobilePortableAttachmentPath,
} from "../../workspace/mobileAttachmentUris";
import { mobileMarkdownHasDiagrams } from "../../workspace/mobileDiagramMarkdown";
import { mobileMarkdownBodyToTentapHtml } from "../../workspace/mobileDocumentContent";
import { mobileWysiwygTentapEditorHtml } from "./MobileWysiwygTentapEditorHtml";
import { copyMobileDiagramRenderer } from "./mobileDiagramRendererAsset.native";

type VaultRootUri = string;
type MarkdownBody = string;
type EditorAppearance = { css: string };

const defaultEditorAppearance: EditorAppearance = { css: "" };

type CachedEditorShell = {
	promise: Promise<string>;
	activeCopies: number;
	lastUsed: number;
};

const preparedShells = new Map<string, CachedEditorShell>();
let cacheInitialization: Promise<void> | null = null;
let shellUseSequence = 0;
const previewCache = `${cacheDirectory}tolaria-editor-previews/`;
const maxCachedEditorShells = 4;

async function initializePreviewCache() {
	if (!cacheDirectory) throw new Error("Editor cache directory unavailable");
	cacheInitialization ??= (async () => {
		await deleteAsync(previewCache, { idempotent: true });
		await makeDirectoryAsync(previewCache, { intermediates: true });
	})().catch((error: unknown) => {
		cacheInitialization = null;
		throw error;
	});
	await cacheInitialization;
}

export function mobileEditorPreviewHtml(
	markdown: MarkdownBody,
	vaultRootUri?: VaultRootUri | null,
): string {
	// Images stay portable in Tiptap JSON and resolve relative to the private shell.
	return mobileMarkdownBodyToTentapHtml(markdown, { diagrams: true }).replace(
		/\bhref=".*?"/gu,
		(link) => mobileHtmlWithResolvedAttachmentUris(link, vaultRootUri),
	);
}

function cachedEditorShell(appearance: EditorAppearance): CachedEditorShell {
	let shell = preparedShells.get(appearance.css);
	if (!shell) {
		const promise = writeEditorShell(appearance).catch((error: unknown) => {
			preparedShells.delete(appearance.css);
			throw error;
		});
		shell = { promise, activeCopies: 0, lastUsed: 0 };
		preparedShells.set(appearance.css, shell);
	}
	shell.lastUsed = ++shellUseSequence;
	return shell;
}

async function copyEditorShell(
	appearance: EditorAppearance,
	destination: string,
) {
	const shell = cachedEditorShell(appearance);
	shell.activeCopies += 1;
	try {
		await copyAsync({ from: await shell.promise, to: destination });
	} finally {
		shell.activeCopies -= 1;
		trimEditorShellCache();
	}
}

function trimEditorShellCache() {
	const unused = [...preparedShells.entries()]
		.filter(([, shell]) => shell.activeCopies === 0)
		.sort((left, right) => left[1].lastUsed - right[1].lastUsed);
	while (preparedShells.size > maxCachedEditorShells && unused.length) {
		const oldest = unused.shift();
		if (!oldest) break;
		const [css, shell] = oldest;
		preparedShells.delete(css);
		void shell.promise
			.then((uri) => deleteAsync(uri, { idempotent: true }))
			.catch(() => undefined);
	}
}

async function writeEditorShell(appearance: EditorAppearance): Promise<string> {
	await initializePreviewCache();
	const uri = `${previewCache}editor-${randomUUID()}.html`;
	await writeAsStringAsync(
		uri,
		mobileEditorHtmlWithAppearance({
			html: mobileWysiwygTentapEditorHtml,
			appearance,
		}),
	);
	return uri;
}

class MobileEditorPreview {
	readonly rootUri = `${previewCache}${randomUUID()}/`;
	readonly source = { uri: `${this.rootUri}editor.html` };
	private readonly copied = new Set<string>();
	private initialized = false;
	private diagramsReady = false;
	private disposed = false;
	private pending: Promise<void> = Promise.resolve();

	private preparedAppearanceCss: string | null = null;

	constructor(
		readonly vaultRootUri: VaultRootUri,
		private appearance: EditorAppearance,
	) {}

	private async preparePaths(paths: readonly string[], diagrams = false) {
		if (this.disposed) throw new Error("Editor preview disposed");
		this.pending = this.pending
			.catch(() => undefined)
			.then(async () => {
				await this.initialize();
				await this.copyImages(paths);
				if (diagrams) await this.prepareDiagrams();
			});
		await this.pending;
	}

	private async initialize() {
		while (
			!this.initialized ||
			this.preparedAppearanceCss !== this.appearance.css
		) {
			const appearanceCss = this.appearance.css;
			await initializePreviewCache();
			await makeDirectoryAsync(this.rootUri, { intermediates: true });
			await copyEditorShell(this.appearance, this.source.uri);
			if (appearanceCss !== this.appearance.css) continue;
			this.preparedAppearanceCss = appearanceCss;
			this.initialized = true;
		}
	}

	private async copyImages(paths: readonly string[]) {
		for (const path of paths) {
			if (this.copied.has(path)) continue;
			if (await this.copyImage(path)) this.copied.add(path);
		}
	}

	private async copyImage(path: string): Promise<boolean> {
		const from = mobileAttachmentUriForHref(path, this.vaultRootUri);
		const to = mobileAttachmentUriForHref(path, this.rootUri);
		if (!from || !to) return false;
		try {
			await makeDirectoryAsync(to.slice(0, to.lastIndexOf("/")), {
				intermediates: true,
			});
			await copyAsync({ from, to });
			return true;
		} catch {
			// A missing attachment must not prevent the note itself from opening.
			return false;
		}
	}

	private async prepareDiagrams() {
		if (this.diagramsReady) return;
		try {
			await copyMobileDiagramRenderer(this.rootUri);
			this.diagramsReady = true;
		} catch {
			/* An optional preview failure must retain the editable source. */
		}
	}

	prepare(markdown: MarkdownBody, appearance = this.appearance) {
		this.appearance = appearance;
		return this.preparePaths(
			previewImagePaths(markdown),
			mobileMarkdownHasDiagrams(markdown, "mermaid"),
		);
	}
	prepareAttachment = (href: string) =>
		this.preparePaths(mobilePortableAttachmentPath(href) ? [href] : []);

	async dispose() {
		this.disposed = true;
		await this.pending.catch(() => undefined);
		await deleteAsync(this.rootUri, { idempotent: true });
	}
}

export function createMobileEditorPreview(
	vaultRootUri: VaultRootUri,
	appearance = defaultEditorAppearance,
) {
	return new MobileEditorPreview(vaultRootUri, appearance);
}

function mobileEditorHtmlWithAppearance({
	html,
	appearance,
}: {
	html: string;
	appearance: EditorAppearance;
}): string {
	if (!appearance.css) return html;
	return html.replace(
		"</head>",
		`<style data-tag="tolaria-editor-appearance">${appearance.css.replace(/<\/style/giu, "<\\/style")}</style></head>`,
	);
}

function previewImagePaths(markdown: MarkdownBody): string[] {
	const html = mobileMarkdownBodyToTentapHtml(markdown);
	return [
		...new Set(
			[...html.matchAll(/\bsrc="(.*?)"/gu)]
				.map((match) => mobilePortableAttachmentPath(match[1] ?? ""))
				.filter((path): path is string => path !== null),
		),
	];
}

export function mobileEditorFileWebViewProps(
	preview: ReturnType<typeof createMobileEditorPreview>,
) {
	return {
		source: preview.source,
		allowingReadAccessToURL: preview.rootUri,
		allowFileAccess: true,
		allowUniversalAccessFromFileURLs: false,
		// Inspect every navigation rather than letting WebView launch external URLs.
		originWhitelist: ["*"],
		onShouldStartLoadWithRequest: ({
			url,
			isTopFrame,
		}: {
			url: string;
			isTopFrame?: boolean;
		}) =>
			url === preview.source.uri ||
			url === "about:blank" ||
			(isTopFrame === false &&
				url === `${preview.rootUri}diagram-renderer.html`),
	};
}

export function useMobileEditorFileSource(
	vaultRootUri: VaultRootUri | null | undefined,
	markdown: MarkdownBody,
	appearance = defaultEditorAppearance,
) {
	const preview = useVaultEditorPreview(vaultRootUri, appearance);
	const { prepared, failed } = useEditorPreviewPreparation(
		preview,
		markdown,
		appearance,
	);
	const webViewProps: Partial<ReturnType<typeof mobileEditorFileWebViewProps>> =
		preview && prepared === preview
			? mobileEditorFileWebViewProps(preview)
			: {};
	return {
		ready: isEditorPreviewReady(preview, prepared, failed),
		webViewProps,
		prepareAttachment: preview?.prepareAttachment,
	};
}

function useVaultEditorPreview(
	vaultRootUri: VaultRootUri | null | undefined,
	appearance: EditorAppearance,
) {
	const [previewState, setPreviewState] = useState(() => ({
		vaultRootUri,
		preview: vaultRootUri
			? createMobileEditorPreview(vaultRootUri, appearance)
			: null,
	}));
	if (previewState.vaultRootUri !== vaultRootUri)
		setPreviewState(createVaultPreviewState(vaultRootUri, appearance));
	const preview =
		previewState.vaultRootUri === vaultRootUri ? previewState.preview : null;
	useEffect(
		() => () => {
			void preview?.dispose().catch(() => undefined);
		},
		[preview],
	);
	return preview;
}

function createVaultPreviewState(
	vaultRootUri: VaultRootUri | null | undefined,
	appearance: EditorAppearance,
) {
	return {
		vaultRootUri,
		preview: vaultRootUri
			? createMobileEditorPreview(vaultRootUri, appearance)
			: null,
	};
}

function useEditorPreviewPreparation(
	preview: MobileEditorPreview | null,
	markdown: MarkdownBody,
	appearance: EditorAppearance,
) {
	const [prepared, setPrepared] = useState<typeof preview>(null);
	const [failed, setFailed] = useState<typeof preview>(null);
	useEffect(
		() =>
			preparePreview({
				appearance,
				callbacks: { prepared: setPrepared, failed: setFailed },
				failedPreview: failed,
				markdown,
				preview,
			}),
		[appearance, preview, markdown, failed],
	);
	return { prepared, failed };
}

function isEditorPreviewReady(
	preview: MobileEditorPreview | null,
	prepared: MobileEditorPreview | null,
	failed: MobileEditorPreview | null,
) {
	return prepared === preview || failed === preview;
}

function preparePreview(options: {
	appearance: EditorAppearance;
	callbacks: {
		prepared: (preview: MobileEditorPreview) => void;
		failed: (preview: MobileEditorPreview) => void;
	};
	failedPreview: MobileEditorPreview | null;
	markdown: MarkdownBody;
	preview: MobileEditorPreview | null;
}) {
	const { appearance, callbacks, failedPreview, markdown, preview } = options;
	// Never replace an inline fallback's source while the user is typing in it.
	if (!preview || preview === failedPreview) return;
	let disposed = false;
	void preview.prepare(markdown, appearance).then(
		() => {
			if (!disposed) callbacks.prepared(preview);
		},
		() => {
			if (!disposed) callbacks.failed(preview);
		},
	);
	return () => {
		disposed = true;
	};
}
