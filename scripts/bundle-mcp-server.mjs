/**
 * Bundle the mcp-server Node.js files into self-contained CJS bundles
 * that can be shipped as Tauri resources inside the .app bundle.
 *
 * Output: src-tauri/resources/mcp-server/{index.js,ws-bridge.js}
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const SRC = join(ROOT, "mcp-server");
const OUT = join(ROOT, "src-tauri", "resources", "mcp-server");

mkdirSync(OUT, { recursive: true });

// Tell Node.js that this directory contains CJS bundles, even if the
// root package.json declares "type": "module".
writeFileSync(join(OUT, "package.json"), JSON.stringify({ type: "commonjs" }));

const shared = {
	platform: "node",
	bundle: true,
	format: "cjs",
	target: "node18",
	// Mark optional native bindings as external — ws works fine without them
	external: ["bufferutil", "utf-8-validate"],
	logLevel: "warning",
};

const indexBuild = await build({
	...shared,
	metafile: true,
	entryPoints: [join(SRC, "index.js")],
	outfile: join(OUT, "index.js"),
});
assertSdkIsBundled(indexBuild.metafile, "index.js");

const bridgeBuild = await build({
	...shared,
	metafile: true,
	entryPoints: [join(SRC, "ws-bridge.js")],
	outfile: join(OUT, "ws-bridge.js"),
});
assertSdkIsBundled(bridgeBuild.metafile, "ws-bridge.js", false);

console.log("mcp-server bundled → src-tauri/resources/mcp-server/");

function assertSdkIsBundled(metafile, bundleName, requireSdk = true) {
	const output = findBundleOutput(metafile, bundleName);
	assertSdkInputIsBundled(output, bundleName, requireSdk);
	assertSdkIsNotExternal(output, bundleName);
}

function findBundleOutput(metafile, bundleName) {
	const output = Object.entries(metafile.outputs).find(([path]) =>
		path.endsWith(`/${bundleName}`),
	)?.[1];
	if (output) return output;
	throw new Error(`${bundleName} was not produced`);
}

function assertSdkInputIsBundled(output, bundleName, requireSdk) {
	const sdkIsIncluded = Object.keys(output.inputs).some((path) =>
		path.includes("@modelcontextprotocol/sdk"),
	);
	if (requireSdk && !sdkIsIncluded) {
		throw new Error(`${bundleName} does not include @modelcontextprotocol/sdk`);
	}
}

function assertSdkIsNotExternal(output, bundleName) {
	const sdkExternal = output.imports.find(
		({ path, external }) =>
			external && path.startsWith("@modelcontextprotocol/sdk"),
	);
	if (sdkExternal) {
		throw new Error(`${bundleName} leaves ${sdkExternal.path} external`);
	}
}
