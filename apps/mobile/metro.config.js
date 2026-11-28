/* global __dirname, module, require */

const { getSentryExpoConfig } = require("@sentry/react-native/metro");
const { withNativeWind } = require("nativewind/metro");
const path = require("node:path");

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, "../..");
const config = getSentryExpoConfig(projectRoot);

config.watchFolders = [workspaceRoot];
const expoPackagePath = require.resolve("expo/package.json");
const pnpmStore = path.resolve(path.dirname(expoPackagePath), "../../..");
if (!pnpmStore.startsWith(`${workspaceRoot}${path.sep}`))
	config.watchFolders.push(pnpmStore);
config.resolver.nodeModulesPaths = [
	path.resolve(projectRoot, "node_modules"),
	path.resolve(workspaceRoot, "node_modules"),
];

module.exports = withNativeWind(config, {
	inlineRem: 16,
	input: "./global.css",
});
