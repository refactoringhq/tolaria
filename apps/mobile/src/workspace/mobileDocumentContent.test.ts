import { describe, expect, it } from "vitest";
import {
	mobileDocumentBody,
	mobileDocumentWithBody,
	mobileMarkdownBodyToTentapHtml,
	mobileNoteEditableContent,
} from "./mobileDocumentContent";

describe("mobile document content", () => {
	it("keeps real raw markdown as the only editable document source", () => {
		const content = mobileNoteEditableContent({
			rawContent: "Paragraph without H1.\n",
			title: "Not inserted",
		});

		expect(content).toBe("Paragraph without H1.\n");
	});

	it("hydrates fixture-only notes from an optional H1 and visible editor blocks", () => {
		const content = mobileNoteEditableContent({
			title: "Workflow Orchestration Essay",
			editorBlocks: [
				{
					kind: "paragraph",
					content: [
						{ text: "Keep " },
						{ bold: true, text: "relationships" },
						{ text: " visible." },
					],
				},
				{
					kind: "bullets",
					items: [{ content: [{ text: "Copy desktop first" }] }],
				},
			],
		});

		expect(content).toBe(
			[
				"# Workflow Orchestration Essay",
				"",
				"Keep **relationships** visible.",
				"",
				"- Copy desktop first",
				"",
			].join("\n"),
		);
	});

	it("extracts the editable markdown body without inventing a title", () => {
		const body = mobileDocumentBody(`---
type: Essay
---
Paragraph without a heading.
`);

		expect(body).toBe("Paragraph without a heading.\n");
	});

	it("preserves frontmatter when the wysiwyg body changes", () => {
		const content = mobileDocumentWithBody(
			`---
type: Essay
tags:
  - Design
---
# Old title
`,
			"# New title\n\nUpdated body.\n",
		);

		expect(content).toBe(`---
type: Essay
tags:
  - Design
---
# New title

Updated body.
`);
	});

	it("preserves raw frontmatter text when only the wysiwyg body changes", () => {
		const content = mobileDocumentWithBody(
			`---
# Keep YAML comments and formatting exactly as authored.
title: "Workflow: mobile"
aliases: ["Mobile, UI", "Tablet"]
related_to:
  - "[[LLM Workflow]]"
status: Draft
---
# Old title
`,
			"# New title\n\nUpdated body.\n",
		);

		expect(content).toBe(`---
# Keep YAML comments and formatting exactly as authored.
title: "Workflow: mobile"
aliases: ["Mobile, UI", "Tablet"]
related_to:
  - "[[LLM Workflow]]"
status: Draft
---
# New title

Updated body.
`);
	});

	it("renders markdown body as initial TenTap html without generating an H1", () => {
		const html = mobileMarkdownBodyToTentapHtml(
			"Paragraph with **bold** and [[Project Alpha|project]].\n",
		);

		expect(html).toContain("<p>Paragraph with <strong>bold</strong>");
		expect(html).toContain('href="tolaria://wikilink/Project%20Alpha"');
		expect(html).not.toContain("<h1>");
	});

	it("renders angle-wrapped attachment links without leaking markdown angle syntax into hrefs", () => {
		const html = mobileMarkdownBodyToTentapHtml(
			"[project brief.pdf](<attachments/project brief.pdf>)\n",
		);

		expect(html).toBe(
			'<p><a href="attachments/project brief.pdf">project brief.pdf</a></p>',
		);
	});

	it("hydrates markdown links whose URLs contain balanced or escaped parentheses", () => {
		const html = mobileMarkdownBodyToTentapHtml(
			"Read [the spec](https://cdn.example.com/Workflow%20Plan%20(1).pdf) and [the copy](https://cdn.example.com/Workflow%20Plan%20\\(2\\).pdf).\n",
		);

		expect(html).toBe(
			'<p>Read <a href="https://cdn.example.com/Workflow%20Plan%20(1).pdf">the spec</a> and <a href="https://cdn.example.com/Workflow%20Plan%20(2).pdf">the copy</a>.</p>',
		);
	});

	it("hydrates markdown links whose labels contain balanced or escaped brackets", () => {
		const html = mobileMarkdownBodyToTentapHtml(
			"Read [Project [Alpha]](https://example.com/alpha) and [Project \\[Beta\\]](https://example.com/beta).\n",
		);

		expect(html).toBe(
			'<p>Read <a href="https://example.com/alpha">Project [Alpha]</a> and <a href="https://example.com/beta">Project [Beta]</a>.</p>',
		);
	});

	it("hydrates markdown autolinks as editable TenTap links", () => {
		const html = mobileMarkdownBodyToTentapHtml(
			"Location: <https://example.com/room?id=42> and <luca@example.com>\n",
		);

		expect(html).toBe(
			'<p>Location: <a href="https://example.com/room?id=42">https://example.com/room?id=42</a> and <a href="mailto:luca@example.com">luca@example.com</a></p>',
		);
	});

	it("preserves desktop highlight markdown while leaving code spans literal", () => {
		const html = mobileMarkdownBodyToTentapHtml(
			"Use ==highlight== but keep `==literal==` as code.\n",
		);

		expect(html).toContain("<mark>highlight</mark>");
		expect(html).toContain("<code>==literal==</code>");
		expect(html).not.toContain("<code><mark>literal</mark></code>");
	});

	it("hydrates inline math as a native TenTap math node without touching code spans", () => {
		const html = mobileMarkdownBodyToTentapHtml(
			"Use $x^2$ but keep `$x^2$` literal.\n",
		);

		expect(html).toContain('data-type="mathInline"');
		expect(html).toContain('data-latex="x^2"');
		expect(html).toContain("<code>$x^2$</code>");
	});

	it("hydrates escaped inline markdown punctuation as literal text", () => {
		const html = mobileMarkdownBodyToTentapHtml(
			"Keep \\(No highlights\\) and ¯\\_(ツ)_/¯\n",
		);

		expect(html).toBe("<p>Keep (No highlights) and ¯_(ツ)_/¯</p>");
		expect(html).not.toContain("<em>");
	});

	it("hydrates simple markdown tables as native TenTap table HTML", () => {
		const html = mobileMarkdownBodyToTentapHtml(
			"| Surface | **Target** |\n| --- | --- |\n| Editor | WYSIWYG |\n",
		);

		expect(html).toBe(
			"<table><thead><tr><th><p>Surface</p></th><th><p><strong>Target</strong></p></th></tr></thead>" +
				"<tbody><tr><td><p>Editor</p></td><td><p>WYSIWYG</p></td></tr></tbody></table>",
		);
	});

	it("renders only table-cell br tags as line breaks while preserving code and other HTML", () => {
		const markdown = [
			"| Task | People |",
			"| --- | --- |",
			"| Makeup<br>Makeup<br/>Assistant | Yully<br />Verena<BR>Peter |",
			"| `literal <br>` | <span>literal HTML</span> |",
			"",
			"Outside <br> stays literal.",
			"",
			"```html",
			"<br>",
			"```",
		].join("\n");
		const html = mobileMarkdownBodyToTentapHtml(markdown);
		const body = mobileDocumentBody(markdown);

		expect(html).toContain("<td><p>Makeup<br>Makeup<br/>Assistant</p></td>");
		expect(html).toContain("<td><p>Yully<br />Verena<BR>Peter</p></td>");
		expect(html).toContain("<code>literal &lt;br&gt;</code>");
		expect(html).toContain("&lt;span&gt;literal HTML&lt;/span&gt;");
		expect(html).toContain("<p>Outside &lt;br&gt; stays literal.</p>");
		expect(html).toContain(
			'<pre><code class="language-html" data-language="html">&lt;br&gt;</code></pre>',
		);
		expect(
			mobileNoteEditableContent({
				rawContent: markdown,
				title: "OneNote Import",
			}),
		).toBe(markdown);
		expect(mobileDocumentWithBody(markdown, body)).toBe(markdown);
	});

	it("hydrates aligned markdown tables as native TenTap table HTML with alignment metadata", () => {
		const html = mobileMarkdownBodyToTentapHtml(
			"| Surface | Target |\n| :--- | ---: |\n| Editor | WYSIWYG |\n",
		);

		expect(html).toBe(
			'<table><thead><tr><th data-tolaria-alignment="left" style="text-align: left"><p>Surface</p></th><th data-tolaria-alignment="right" style="text-align: right"><p>Target</p></th></tr></thead>' +
				'<tbody><tr><td data-tolaria-alignment="left" style="text-align: left"><p>Editor</p></td><td data-tolaria-alignment="right" style="text-align: right"><p>WYSIWYG</p></td></tr></tbody></table>',
		);
	});

	it("hydrates root display math blocks as native TenTap math nodes", () => {
		const html = mobileMarkdownBodyToTentapHtml(
			"Intro\n\n$$\n\\int_0^1 x\\,dx\n$$\n\nDone\n",
		);

		expect(html).toContain("<p>Intro</p>");
		expect(html).toContain('data-type="mathBlock"');
		expect(html).toContain('data-latex="\\int_0^1 x\\,dx"');
		expect(html).toContain("<p>Done</p>");
	});

	it("hydrates single-line root display math as a native TenTap math node", () => {
		const html = mobileMarkdownBodyToTentapHtml("$$x^2$$\n");

		expect(html).toContain('data-type="mathBlock"');
		expect(html).toContain('data-latex="x^2"');
	});

	it("hydrates blockquotes without collapsing explicit breaks or quoted paragraphs", () => {
		const html = mobileMarkdownBodyToTentapHtml(
			"> First quote line  \n> Second line\n> \n> Follow-up paragraph\n\nDone\n",
		);

		expect(html).toBe(
			"<blockquote><p>First quote line<br>Second line</p><p>Follow-up paragraph</p></blockquote>\n<p>Done</p>",
		);
	});

	it("hydrates blockquotes with non-code leading spaces as native quote nodes", () => {
		const html = mobileMarkdownBodyToTentapHtml(
			"  > First quote line\n  > Second line\n\nDone\n",
		);

		expect(html).toBe(
			"<blockquote><p>First quote line Second line</p></blockquote>\n<p>Done</p>",
		);
	});

	it("keeps code-indented blockquote markers editable as source until indented code editing is supported", () => {
		const html = mobileMarkdownBodyToTentapHtml(
			"    > First quote line\n    > Second line\n\nDone\n",
		);

		expect(html).toBe(
			"<p>    &gt; First quote line<br>    &gt; Second line</p>\n<p>Done</p>",
		);
		expect(html).not.toContain("<blockquote>");
	});

	it("hydrates display math with non-code leading spaces as native TenTap math nodes", () => {
		const html = mobileMarkdownBodyToTentapHtml("  $$\n  x^2\n  $$\n\nDone\n");

		expect(html).toContain('data-type="mathBlock"');
		expect(html).toContain('data-latex="x^2"');
		expect(html).toContain("<p>Done</p>");
	});

	it("keeps code-indented display math blocks editable as source until indented code editing is supported", () => {
		const html = mobileMarkdownBodyToTentapHtml(
			"    $$\n    x^2\n    $$\n\nDone\n",
		);

		expect(html).toBe("<p>    $$<br>    x^2<br>    $$</p>\n<p>Done</p>");
		expect(html).not.toContain('data-type="mathBlock"');
	});

	it("keeps unsupported details blocks editable as escaped markdown source", () => {
		const html = mobileMarkdownBodyToTentapHtml(
			[
				"<details><summary>Manufacturing</summary>",
				"",
				"Made in Italy",
				"",
				"</details>",
				"",
				"Done",
				"",
			].join("\n"),
		);

		expect(html).toBe(
			"<p>&lt;details&gt;&lt;summary&gt;Manufacturing&lt;/summary&gt;<br><br>Made in Italy<br><br>&lt;/details&gt;</p>\n<p>Done</p>",
		);
	});

	it("keeps unsupported html comment blocks editable as markdown source", () => {
		const html = mobileMarkdownBodyToTentapHtml(
			["Intro", "", "<!--", '{"fold":true}', "-->", "", "Done", ""].join("\n"),
		);

		expect(html).toBe(
			"<p>Intro</p>\n<p>&lt;!--<br>{&quot;fold&quot;:true}<br>--&gt;</p>\n<p>Done</p>",
		);
	});

	it("hydrates nested desktop markdown lists without flattening indentation", () => {
		const html = mobileMarkdownBodyToTentapHtml(
			"- Parent\n  - Child with **bold**\n- Sibling\n",
		);
		const taskHtml = mobileMarkdownBodyToTentapHtml(
			"- [x] Parent\n  - [ ] Child\n",
		);

		expect(html).toBe(
			"<ul><li><p>Parent</p><ul><li><p>Child with <strong>bold</strong></p></li></ul></li><li><p>Sibling</p></li></ul>",
		);
		expect(taskHtml).toBe(
			'<ul data-type="taskList"><li data-type="taskItem" data-checked="true"><label><input type="checkbox" checked="checked"><span></span></label><div><p>Parent</p><ul data-type="taskList"><li data-type="taskItem" data-checked="false"><label><input type="checkbox"><span></span></label><div><p>Child</p></div></li></ul></div></li></ul>',
		);
	});

	it("hydrates simple fenced code blocks as native TenTap codeBlock nodes with language metadata", () => {
		const html = mobileMarkdownBodyToTentapHtml(
			'```ts\nconst parity = "desktop"\n```\n\nDone\n',
		);

		expect(html).toBe(
			'<pre><code class="language-ts" data-language="ts">const parity = &quot;desktop&quot;</code></pre>\n<p>Done</p>',
		);
	});

	it("keeps complex fenced-code metadata editable as exact source until native codeBlock metadata can round-trip it", () => {
		const html = mobileMarkdownBodyToTentapHtml(
			"```plain text\nprompt: keep [[literal]]\n```\n\nDone\n",
		);

		expect(html).toBe(
			"<p>```plain text<br>prompt: keep [[literal]]<br>```</p>\n<p>Done</p>",
		);
		expect(
			mobileMarkdownBodyToTentapHtml(
				"~~~mermaid\nflowchart LR\nA --> B\n~~~\n",
			),
		).toBe("<p>~~~mermaid<br>flowchart LR<br>A --&gt; B<br>~~~</p>");
	});

	it("hydrates fenced code with non-code leading spaces as native codeBlock nodes", () => {
		const html = mobileMarkdownBodyToTentapHtml(
			"  ```ts\n  const x = 1\n  ```\n\nDone\n",
		);

		expect(html).toBe(
			'<pre><code class="language-ts" data-language="ts">const x = 1</code></pre>\n<p>Done</p>',
		);
	});

	it("keeps code-indented fenced code editable as source until indented code editing is supported", () => {
		const html = mobileMarkdownBodyToTentapHtml(
			"    ```ts\n    const x = 1\n    ```\n\nDone\n",
		);

		expect(html).toBe(
			"<p>    ```ts<br>    const x = 1<br>    ```</p>\n<p>Done</p>",
		);
		expect(html).not.toContain("<pre>");
	});

	it("keeps root indented text blocks editable as source until indented code editing is supported", () => {
		const html = mobileMarkdownBodyToTentapHtml(
			"    Teach your AI agent the workflow context.\n    Then run the task.\n\nDone\n",
		);

		expect(html).toBe(
			"<p>    Teach your AI agent the workflow context.<br>    Then run the task.</p>\n<p>Done</p>",
		);
	});

	it("hydrates explicit markdown hard breaks as TenTap line breaks", () => {
		const html = mobileMarkdownBodyToTentapHtml(
			"Line one  \nLine two\nSoft\nwrapped\n\nBackslash\\\nbreak\n",
		);

		expect(html).toBe(
			"<p>Line one<br>Line two Soft wrapped</p>\n<p>Backslash<br>break</p>",
		);
	});

	it("renders standalone markdown images as TenTap image nodes without changing portable attachment refs", () => {
		const html = mobileMarkdownBodyToTentapHtml(
			"![Architecture diagram](<attachments/mobile diagram.png>)\n",
		);

		expect(html).toBe(
			'<img src="attachments/mobile diagram.png" alt="Architecture diagram">',
		);
		expect(html).not.toContain("<a ");
	});

	it("renders standalone markdown images whose URLs contain balanced parentheses", () => {
		const html = mobileMarkdownBodyToTentapHtml(
			"![](https://cdn.example.com/Opengraph%20-%20Home%20Page%20(1).jpg)\n",
		);
		const escapedHtml = mobileMarkdownBodyToTentapHtml(
			"![](https://cdn.example.com/Opengraph%20-%20Home%20Page%20\\(1\\).jpg)\n",
		);

		expect(html).toBe(
			'<img src="https://cdn.example.com/Opengraph%20-%20Home%20Page%20(1).jpg" alt="">',
		);
		expect(escapedHtml).toBe(html);
	});

	it("preserves markdown image titles as native image metadata", () => {
		const html = mobileMarkdownBodyToTentapHtml(
			'![shot](attachments/file.png "starter vault")\n',
		);

		expect(html).toBe(
			'<img src="attachments/file.png" alt="shot" title="starter vault">',
		);
	});

	it("hydrates markdown images with non-code leading spaces as native TenTap image nodes", () => {
		const html = mobileMarkdownBodyToTentapHtml(
			"  ![](https://example.com/agent.png)\n\nDone\n",
		);

		expect(html).toBe(
			'<img src="https://example.com/agent.png" alt="">\n<p>Done</p>',
		);
	});

	it("keeps code-indented markdown images editable as source until indented code editing is supported", () => {
		const html = mobileMarkdownBodyToTentapHtml(
			"    ![](https://example.com/agent.png)\n\nDone\n",
		);

		expect(html).toBe(
			"<p>    ![](https://example.com/agent.png)</p>\n<p>Done</p>",
		);
		expect(html).not.toContain("<img");
	});

	it("hydrates markdown headings with non-code leading spaces as native heading nodes", () => {
		const html = mobileMarkdownBodyToTentapHtml(
			"  ### Daniel Yeboah\n\nDone\n",
		);

		expect(html).toBe("<h3>Daniel Yeboah</h3>\n<p>Done</p>");
	});

	it("keeps code-indented markdown headings editable as source until indented code editing is supported", () => {
		const html = mobileMarkdownBodyToTentapHtml(
			"    ### Daniel Yeboah\n\nDone\n",
		);

		expect(html).toBe("<p>    ### Daniel Yeboah</p>\n<p>Done</p>");
		expect(html).not.toContain("<h3>");
	});

	it("hydrates list markers with non-code leading spaces as native list nodes", () => {
		const html = mobileMarkdownBodyToTentapHtml(
			"  1. Contextualize: Dump TOC into an LLM.\n  2. Summarize major sections.\n\nDone\n",
		);

		expect(html).toBe(
			"<ol><li><p>Contextualize: Dump TOC into an LLM.</p></li><li><p>Summarize major sections.</p></li></ol>\n<p>Done</p>",
		);
	});

	it("keeps code-indented list markers editable as source until indented code editing is supported", () => {
		const html = mobileMarkdownBodyToTentapHtml(
			"    1. Contextualize: Dump TOC into an LLM.\n    2. Summarize major sections.\n\nDone\n",
		);

		expect(html).toBe(
			"<p>    1. Contextualize: Dump TOC into an LLM.<br>    2. Summarize major sections.</p>\n<p>Done</p>",
		);
		expect(html).not.toContain("<ol>");
	});
});
