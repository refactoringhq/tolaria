import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { describe, expect, it } from "vitest";

// Reanimated runs these callbacks on the UI thread. Calling a plain JS
// function from there throws, and in release builds that crashes the app as
// soon as a swipeable note row renders (TOL-310 alpha crash on open).
const swipeFiles = [
	"mobileNoteSwipe.ts",
	"MobileNoteSwipeActions.tsx",
	"MobileSwipeableNoteRow.tsx",
	"MobileListMotion.internal.tsx",
];
const workletHooks = new Set([
	"useAnimatedStyle",
	"useDerivedValue",
	"useAnimatedReaction",
	"useAnimatedProps",
]);
const gestureCallbacks = new Set([
	"onBegin",
	"onStart",
	"onUpdate",
	"onChange",
	"onEnd",
	"onFinalize",
	"onTouchesDown",
	"onTouchesMove",
	"onTouchesUp",
	"onTouchesCancelled",
]);

type FunctionLike = ts.FunctionLikeDeclaration;
type ModuleInfo = {
	source: ts.SourceFile;
	functions: Map<string, FunctionLike>;
	imports: Map<string, { module: string; name: string }>;
};

const modules = new Map<string, ModuleInfo>();

function loadModule(fileName: string): ModuleInfo | undefined {
	if (modules.has(fileName)) return modules.get(fileName);
	let text: string;
	try {
		text = readFileSync(
			fileURLToPath(new URL(`./${fileName}`, import.meta.url)),
			"utf8",
		);
	} catch {
		return undefined;
	}
	const source = ts.createSourceFile(
		fileName,
		text,
		ts.ScriptTarget.Latest,
		true,
		fileName.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
	);
	const functions = new Map<string, FunctionLike>();
	const imports = new Map<string, { module: string; name: string }>();
	const visit = (node: ts.Node) => {
		if (ts.isFunctionDeclaration(node) && node.name) {
			functions.set(node.name.text, node);
		}
		if (
			ts.isVariableDeclaration(node) &&
			ts.isIdentifier(node.name) &&
			node.initializer &&
			(ts.isArrowFunction(node.initializer) ||
				ts.isFunctionExpression(node.initializer))
		) {
			functions.set(node.name.text, node.initializer);
		}
		if (
			ts.isImportDeclaration(node) &&
			ts.isStringLiteral(node.moduleSpecifier) &&
			node.moduleSpecifier.text.startsWith("./")
		) {
			const bindings = node.importClause?.namedBindings;
			if (bindings && ts.isNamedImports(bindings)) {
				for (const element of bindings.elements) {
					imports.set(element.name.text, {
						module: node.moduleSpecifier.text.slice(2),
						name: (element.propertyName ?? element.name).text,
					});
				}
			}
		}
		ts.forEachChild(node, visit);
	};
	visit(source);
	const info = { source, functions, imports };
	modules.set(fileName, info);
	return info;
}

function isWorklet(fn: FunctionLike) {
	const body = fn.body;
	if (!body || !ts.isBlock(body)) return false;
	const first = body.statements[0];
	return (
		!!first &&
		ts.isExpressionStatement(first) &&
		ts.isStringLiteral(first.expression) &&
		first.expression.text === "worklet"
	);
}

function resolveFunction(info: ModuleInfo, name: string) {
	const local = info.functions.get(name);
	if (local) return { fn: local, where: info.source.fileName };
	const imported = info.imports.get(name);
	if (!imported) return undefined;
	for (const extension of [".ts", ".tsx"]) {
		const target = loadModule(`${imported.module}${extension}`);
		const fn = target?.functions.get(imported.name);
		if (fn) return { fn, where: target?.source.fileName ?? "" };
	}
	return undefined;
}

function workletRoots(info: ModuleInfo) {
	const roots: FunctionLike[] = [];
	const visit = (node: ts.Node) => {
		if (ts.isFunctionLike(node) && isWorklet(node as FunctionLike)) {
			roots.push(node as FunctionLike);
		}
		if (ts.isCallExpression(node)) {
			const callee = node.expression;
			const name = ts.isIdentifier(callee)
				? callee.text
				: ts.isPropertyAccessExpression(callee)
					? callee.name.text
					: "";
			const isRoot = ts.isIdentifier(callee)
				? workletHooks.has(name)
				: gestureCallbacks.has(name);
			const first = node.arguments[0];
			if (
				isRoot &&
				first &&
				(ts.isArrowFunction(first) || ts.isFunctionExpression(first))
			) {
				roots.push(first);
			}
		}
		ts.forEachChild(node, visit);
	};
	visit(info.source);
	return roots;
}

function nonWorkletCalls(fileName: string) {
	const info = loadModule(fileName);
	if (!info) throw new Error(`Missing ${fileName}`);
	const problems = new Set<string>();
	const checked = new Set<FunctionLike>();
	const walk = (fn: FunctionLike, owner: ModuleInfo) => {
		if (checked.has(fn)) return;
		checked.add(fn);
		const visit = (node: ts.Node) => {
			if (
				ts.isCallExpression(node) &&
				ts.isIdentifier(node.expression) &&
				node.expression.text !== "runOnJS" &&
				node.expression.text !== "scheduleOnRN"
			) {
				const resolved = resolveFunction(owner, node.expression.text);
				if (resolved && !isWorklet(resolved.fn)) {
					problems.add(`${node.expression.text} (${resolved.where})`);
				} else if (resolved) {
					const target = loadModule(resolved.where);
					if (target) walk(resolved.fn, target);
				}
			}
			if (ts.isParameter(node) && node.initializer) visit(node.initializer);
			ts.forEachChild(node, visit);
		};
		fn.parameters.forEach(visit);
		if (fn.body) visit(fn.body);
	};
	for (const root of workletRoots(info)) walk(root, info);
	return [...problems].sort();
}

describe("note swipe worklets", () => {
	it.each(swipeFiles)(
		"%s only calls worklets from UI-thread code",
		(fileName) => {
			expect(nonWorkletCalls(fileName)).toEqual([]);
		},
	);
});
