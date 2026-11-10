#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const [device, requestedOutput] = process.argv.slice(2);
if (!device)
	throw new Error(
		"Usage: node test-ios-motion-frames.mjs SIMULATOR_UDID [ARTIFACT_DIRECTORY]",
	);
if (process.env.EXPO_PUBLIC_TOLARIA_MOTION_FRAME_PROBE !== "1") {
	throw new Error(
		"Start Metro with EXPO_PUBLIC_TOLARIA_MOTION_FRAME_PROBE=1 before running the motion tests",
	);
}
if (!process.env.EXPO_PUBLIC_TOLARIA_MOTION_BUILD_ID) {
	throw new Error(
		"Set EXPO_PUBLIC_TOLARIA_MOTION_BUILD_ID to the commit/build identifier loaded by Metro",
	);
}

const output = resolve(
	requestedOutput ?? join(tmpdir(), "tolaria-motion-frame-qa"),
);
const project = join(output, "project");
const metroLogPath = process.env.TOLARIA_MOTION_LOG_PATH;
if (!metroLogPath)
	throw new Error(
		"Set TOLARIA_MOTION_LOG_PATH to the file receiving this build's Metro output",
	);
mkdirSync(output, { recursive: true });
run("xcrun", [
	"simctl",
	"get_app_container",
	device,
	"com.tolaria.mobile.dev",
	"app",
]);
run("ruby", [
	fileURLToPath(
		new URL("../native-ui-tests/create-project.rb", import.meta.url),
	),
	project,
]);
const resultBundle = join(output, `motion-${Date.now()}.xcresult`);
const focusedCheck = process.env.TOLARIA_MOTION_CHECK;
run(
	"xcrun",
	[
		"simctl",
		"uninstall",
		device,
		"com.tolaria.mobile.tablet-gesture-tests.xctrunner",
	],
	{ allowFailure: true },
);
run("xcodebuild", [
	"-project",
	join(project, "TabletPanelGestureTests.xcodeproj"),
	"-scheme",
	"TabletPanelGestureTests",
	"-destination",
	`id=${device}`,
	"-derivedDataPath",
	join(output, "derived"),
	"-resultBundlePath",
	resultBundle,
	"-collect-test-diagnostics",
	"never",
	"-parallel-testing-enabled",
	"NO",
	"-only-testing:TabletPanelGestureTests/MobileMotionFrameTests",
	"CODE_SIGNING_ALLOWED=NO",
	"test",
]);
const logPath = join(output, "simulator-motion.log");
writeFileSync(logPath, readFileSync(metroLogPath));
const analysis = run(
	"node",
	[
		fileURLToPath(new URL("./analyze-motion-frame-log.mjs", import.meta.url)),
		logPath,
		...(focusedCheck === "new-note" ? ["--new-note-only"] : []),
	],
	{ capture: true },
);
writeFileSync(join(output, "motion-analysis.json"), analysis.stdout);
process.stdout.write(
	`${analysis.stdout}\nArtifacts: ${output}\nResult bundle: ${resultBundle}\n`,
);

function run(command, args, options = {}) {
	const result = spawnSync(command, args, {
		encoding: "utf8",
		stdio: options.capture ? "pipe" : "inherit",
	});
	if (result.error) throw result.error;
	if (result.status !== 0 && !options.allowFailure) {
		process.stderr.write(result.stderr ?? "");
		throw new Error(`${command} failed with exit ${result.status}`);
	}
	return result;
}
