import { readFileSync } from "node:fs";
import ts from "typescript";
import { expect, it } from "vitest";

it("keeps relationship submission outside scrolling fields and pinned above the keyboard", () => {
	const { footers, scrollingFooters, source } = relationshipFooters();
	expect(scrollingFooters).toHaveLength(0);
	expect(footers).toHaveLength(1);
	const attributes = footers[0].attributes.properties.map((node) =>
		node.getText(source),
	);
	expect(attributes).toContain("pinned");
	expect(attributes).toContain("visible={!props.compactForm}");
});

function relationshipForm() {
	const path = new URL("./MobileWorkspacePropertyForms.tsx", import.meta.url);
	const source = ts.createSourceFile(
		path.pathname,
		readFileSync(path, "utf8"),
		ts.ScriptTarget.Latest,
		true,
		ts.ScriptKind.TSX,
	);
	const form = source.statements.find(
		(node) =>
			ts.isFunctionDeclaration(node) &&
			node.name?.text === "AddRelationshipContent",
	);
	if (!form) throw new Error("Relationship form is missing");
	return { source, form };
}

function relationshipFooters() {
	const { form, source } = relationshipForm();
	const footers: ts.JsxSelfClosingElement[] = [];
	const scrollingFooters: ts.JsxSelfClosingElement[] = [];
	const visit = (node: ts.Node, scrolling = false) => {
		const insideScroll =
			scrolling ||
			(ts.isJsxElement(node) &&
				node.openingElement.tagName.getText(source) === "ScrollView");
		if (
			ts.isJsxSelfClosingElement(node) &&
			node.tagName.getText(source) === "RelationshipFormFooter"
		) {
			footers.push(node);
			if (insideScroll) scrollingFooters.push(node);
		}
		ts.forEachChild(node, (child) => visit(child, insideScroll));
	};
	visit(form);
	return { footers, scrollingFooters, source };
}
