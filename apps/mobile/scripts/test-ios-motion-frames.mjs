#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
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
const motionSearch =
	process.env.TOLARIA_MOTION_SEARCH ??
	"?source=fixture&phoneState=list&editorMode=wysiwyg&layoutProbe=1&qaRun=tol339-motion";
const logStartOffset = statSync(metroLogPath).size;
run("xcrun", [
	"simctl",
	"launch",
	"--terminate-running-process",
	device,
	"com.tolaria.mobile.dev",
	"--tolaria-mobile-search",
	motionSearch,
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
const nativeTests = run(
	"xcodebuild",
	[
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
		...(focusedCheck === "note-open"
			? [
					"-only-testing:TabletPanelGestureTests/MobileMotionFrameTests/testListChromeEditorReturnSidebarCloseAndOrganizeSwipeAreReachable",
				]
			: focusedCheck === "note-open-route"
				? [
						"-only-testing:TabletPanelGestureTests/MobileMotionFrameTests/testNoteOpenBodyRenderCountViaEditorLaunchRoute",
					]
				: focusedCheck === "new-note"
					? [
							"-only-testing:TabletPanelGestureTests/MobileMotionFrameTests/testNewNoteHeaderAndBodyEnterTogether",
						]
					: focusedCheck === "launch"
						? [
								"-only-testing:TabletPanelGestureTests/MobileMotionFrameTests/testLargeVaultLaunchKeepsListChromeReachable",
							]
						: [
								"-only-testing:TabletPanelGestureTests/MobileMotionFrameTests/testListChromeEditorReturnSidebarCloseAndOrganizeSwipeAreReachable",
								"-only-testing:TabletPanelGestureTests/MobileMotionFrameTests/testNewNoteHeaderAndBodyEnterTogether",
							]),
		"CODE_SIGNING_ALLOWED=NO",
		"test",
	],
	{ allowFailure: true },
);
const logPath = join(output, "simulator-motion.log");
writeFileSync(logPath, readFileSync(metroLogPath).subarray(logStartOffset));
const analysis = run(
	"node",
	[
		fileURLToPath(new URL("./analyze-motion-frame-log.mjs", import.meta.url)),
		logPath,
		...(["note-open", "note-open-route"].includes(focusedCheck)
			? ["--note-body-only"]
			: []),
		...(focusedCheck === "new-note" ? ["--new-note-only"] : []),
		...(focusedCheck === "launch" ? ["--launch-only"] : []),
	],
	{ allowFailure: true, capture: true },
);
writeFileSync(join(output, "motion-analysis.json"), analysis.stdout);
process.stdout.write(
	`${analysis.stdout}\nArtifacts: ${output}\nResult bundle: ${resultBundle}\n`,
);
if (nativeTests.status !== 0) process.exitCode = nativeTests.status;
else if (analysis.status !== 0) process.exitCode = analysis.status;

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
