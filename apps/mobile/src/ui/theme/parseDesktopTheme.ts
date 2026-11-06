import postcss from "postcss";

type Variables = Record<string, string>;

// Build/test only. The native runtime imports the generated JSON, never CSS parsers.
export function parseDesktopThemes(css: string) {
	const root = postcss.parse(css);
	const light = readTheme(root, "light");
	const dark = new Map([...light, ...readTheme(root, "dark")]);
	return {
		light: resolveTheme(light),
		dark: resolveTheme(dark),
	};
}

function readTheme(root: postcss.Root, mode: "light" | "dark") {
	const variables = new Map<string, string>();
	root.walkRules((rule) => {
		if (!rule.selectors.includes(`[data-theme="${mode}"]`)) return;
		rule.walkDecls((declaration) => {
			if (declaration.prop.startsWith("--"))
				variables.set(declaration.prop, declaration.value);
		});
	});
	if (variables.size === 0) throw new Error(`Missing desktop ${mode} theme`);
	return variables;
}

function resolveTheme(variables: Map<string, string>): Variables {
	return Object.fromEntries(
		[...variables.keys()]
			.sort()
			.map((key) => [key, resolveVariable(key, variables)]),
	);
}

function resolveVariable(
	key: string,
	variables: Map<string, string>,
	visited = new Set<string>(),
): string {
	if (visited.has(key)) throw new Error(`Cyclic theme variable ${key}`);
	const value = variables.get(key);
	if (value === undefined) throw new Error(`Missing theme variable ${key}`);
	const chain = new Set([...visited, key]);
	const resolved = value.replace(
		/var\(\s*(--[\w-]+)\s*\)/g,
		(_match, alias: string) => resolveVariable(alias, variables, chain),
	);
	return /^#[\da-f]{3,8}$/i.test(resolved) ? resolved.toUpperCase() : resolved;
}
