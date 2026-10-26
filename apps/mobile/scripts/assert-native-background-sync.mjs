/* global console, process, setTimeout, clearTimeout */

import { Buffer } from "node:buffer";
import { execFileSync } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { withNativeSimulatorLease } from "../src/qa/nativeSimulatorLease.ts";
import {
	gitTestEnvironment,
	startGitTestServer,
} from "../src/workspace/git/gitTestServer.ts";

const device = process.env.TOLARIA_QA_DEVICE;
if (!device)
	throw new Error("Set TOLARIA_QA_DEVICE to an explicit simulator UUID");
const bundleId = process.env.TOLARIA_QA_BUNDLE_ID ?? "com.tolaria.mobile.dev";
const runGit = (args) =>
	execFileSync("git", args, { env: gitTestEnvironment(), stdio: "pipe" })
		.toString()
		.trim();

async function fixture(root) {
	const remote = join(root, "team/vault.git");
	const seed = join(root, "seed");
	await mkdir(remote, { recursive: true });
	await mkdir(seed);
	runGit(["init", "--bare", "--initial-branch=main", remote]);
	runGit(["init", "--initial-branch=main", seed]);
	await writeFile(join(seed, "note.md"), "# Initial\n");
	runGit(["-C", seed, "add", "."]);
	runGit([
		"-C",
		seed,
		"-c",
		"user.name=QA",
		"-c",
		"user.email=qa@example.invalid",
		"commit",
		"-m",
		"Fixture",
	]);
	runGit(["-C", seed, "push", remote, "main"]);
	return remote;
}

async function receive(request, response, resolve, reject) {
	const chunks = [];
	for await (const chunk of request) chunks.push(chunk);
	response.end("ok");
	try {
		resolve(JSON.parse(Buffer.concat(chunks).toString()));
	} catch (error) {
		reject(error);
	}
}

async function probe() {
	const root = await mkdtemp(join(tmpdir(), "tolaria-background-"));
	let server;
	let timer;
	let resolveProof;
	let rejectProof;
	try {
		const remote = await fixture(root);
		const proof = new Promise((accept, fail) => {
			resolveProof = accept;
			rejectProof = fail;
			timer = setTimeout(
				() => fail(new Error("Background proof timed out")),
				150_000,
			);
		});
		server = await startGitTestServer(root, (request, response) =>
			handleRequest(request, response, resolveProof, rejectProof),
		);
		const qaDirectory = await installTrigger(root, server.url);
		const result = await proof;
		console.log(
			"Native background sync proof received before remote assertion:",
			JSON.stringify(result, null, 2),
		);
		const persistedProof = JSON.parse(
			await readFile(join(qaDirectory, "tol75-proof.json"), "utf8"),
		);
		const remoteDraft = readRemoteDraft(remote);
		console.log(
			JSON.stringify({ ...result, ...remoteDraft, persistedProof }, null, 2),
		);
		if (!proofPassed(result, persistedProof, remoteDraft)) process.exitCode = 1;
	} finally {
		clearTimeout(timer);
		await server?.close();
		await rm(root, { recursive: true, force: true });
	}
}

async function installTrigger(root, endpoint) {
	const container = execFileSync("xcrun", [
		"simctl",
		"get_app_container",
		device,
		bundleId,
		"data",
	])
		.toString()
		.trim();
	const qaDirectory = join(container, "Documents", "qa");
	await mkdir(qaDirectory, { recursive: true });
	const triggerPath = join(root, "tol75.json");
	await writeFile(triggerPath, JSON.stringify({ endpoint }));
	execFileSync("cp", [triggerPath, join(qaDirectory, "tol75.json")]);
	execFileSync("xcrun", [
		"simctl",
		"launch",
		"--terminate-running-process",
		device,
		bundleId,
	]);
	return qaDirectory;
}

function handleRequest(request, response, resolve, reject) {
	if (request.url === "/ready") {
		response.end("ok");
		console.log(
			"READY: switching the simulator to Settings to leave Tolaria in the background.",
		);
		execFileSync("xcrun", [
			"simctl",
			"launch",
			device,
			"com.apple.Preferences",
		]);
		return true;
	}
	if (request.url !== "/proof") return false;
	void receive(request, response, resolve, reject).catch(reject);
	return true;
}

function readRemoteDraft(remote) {
	try {
		const saved = runGit(["--git-dir", remote, "show", "main:background.md"]);
		return {
			draftPreserved:
				saved === "---\ncustom: preserved\n---\n# Background draft",
		};
	} catch (error) {
		return { draftPreserved: false, remoteAssertionError: String(error) };
	}
}

function proofPassed(result, persistedProof, remoteDraft) {
	return (
		result.passed &&
		remoteDraft.draftPreserved &&
		result.state === "background" &&
		!remoteDraft.remoteAssertionError &&
		JSON.stringify(persistedProof) === JSON.stringify(result)
	);
}

await withNativeSimulatorLease(probe);
