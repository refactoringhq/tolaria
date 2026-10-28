import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

test("editor bundle uses installed TenTap source instead of its opaque dependency bundle", async () => {
	const workingDirectory = process.cwd();
	const builder = await import("./build-wysiwyg-editor-html.mjs");
	assert.equal(typeof builder.buildEditorBundle, "function");
	const result = await builder.buildEditorBundle();
	const inputs = Object.keys(result.metafile.inputs);
	assert.ok(
		inputs.some((input) => input.endsWith("/src/webEditorUtils/useTenTap.tsx")),
	);
	assert.ok(
		inputs.some((input) => input.includes("/@tiptap/core/dist/index.js")),
	);
	assert.equal(
		inputs.some((input) => /tentap-editor\/lib-web\/index\./.test(input)),
		false,
	);
	assert.equal(
		inputs.some((input) => /react-native\/index\./.test(input)),
		false,
	);
	assert.equal(
		inputs.filter((input) =>
			/\/@tiptap\/core\/dist\/index\.(?:cjs|js)$/.test(input),
		).length,
		1,
	);
	assert.equal(
		inputs.filter((input) =>
			/\/prosemirror-state\/dist\/index\.(?:cjs|js)$/.test(input),
		).length,
		1,
	);
	const editorBundle = result.outputFiles.find((file) =>
		file.path.endsWith(".js"),
	)?.text;
	assert.ok(editorBundle?.includes("ReactNativeWebView"));
	assert.ok(editorBundle?.includes('name:"horizontalRule"'));
	const horizontalRuleInputRule = String.raw`find:/^(?:---|—-|___\s|\*\*\*\s)$/`;
	assert.ok(editorBundle?.includes(horizontalRuleInputRule));
	const generatedHtml = readFileSync(
		new URL(
			"../src/components/workspace/MobileWysiwygTentapEditorHtml.ts",
			import.meta.url,
		),
		"utf8",
	);
	assert.ok(
		generatedHtml.includes(
			JSON.stringify(horizontalRuleInputRule).slice(1, -1),
		),
	);
	assert.equal(process.cwd(), workingDirectory);
});
