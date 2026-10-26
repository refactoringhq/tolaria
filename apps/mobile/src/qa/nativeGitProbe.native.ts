import { requireOptionalNativeModule } from "expo";
import { File, Paths } from "expo-file-system";
import { useEffect } from "react";
import { Linking } from "react-native";
import { nativeMobileLaunchSearch } from "../native/mobileNativeKeyCommands";
import { nativeStorageQaEnabled } from "./nativeStorageQaCapability";

export function useNativeGitProbe() {
	useEffect(() => {
		if (!storageProbeAvailable()) return;
		const subscription = Linking.addEventListener("url", ({ url }) => {
			void runProbeUrl(url);
		});
		const search = nativeMobileLaunchSearch();
		if (search) void runProbeUrl(`tolaria:///${search}`);
		else
			void Linking.getInitialURL()
				.then(runProbeUrl)
				.catch(() => undefined);
		if (__DEV__) void runStartupBackgroundSyncProbe();
		return () => subscription.remove();
	}, []);
}

async function runStartupBackgroundSyncProbe() {
	const trigger = new File(Paths.document, "qa", "tol75.json");
	if (!trigger.exists) return;

	const proofFile = new File(Paths.document, "qa", "tol75-proof.json");
	let proof: object;
	try {
		const { endpoint } = JSON.parse(await trigger.text()) as {
			endpoint?: unknown;
		};
		if (typeof endpoint !== "string" || !isLoopbackEndpoint(endpoint)) {
			throw new Error("invalidQaEndpoint");
		}
		trigger.delete();
		const { runNativeBackgroundSyncProbe } = await import(
			"./nativeBackgroundSyncProbe"
		);
		proof = await runNativeBackgroundSyncProbe(endpoint, (value) => {
			proofFile.write(JSON.stringify(value, null, 2));
		});
	} catch (error) {
		proof = { passed: false, error: String(error) };
		proofFile.write(JSON.stringify(proof, null, 2));
	}
}

async function runProbeUrl(url: string | null) {
	if (!url) return;
	try {
		const endpoint = new URL(url).searchParams.get("gitProbe");
		if (!endpoint || !isLoopbackEndpoint(endpoint)) return;
		const recoveryPhase = new URL(url).searchParams.get("writeRecoveryProbe");
		if (recoveryPhase) {
			const { runNativeWriteRecoveryProbe } = await import(
				"./nativeWriteRecoveryProbe"
			);
			await runNativeWriteRecoveryProbe(endpoint, recoveryPhase);
			return;
		}
		await runGitProbe(url, endpoint);
	} catch (error) {
		console.warn("[native-git-probe] Unable to run probe", error);
	}
}

async function runGitProbe(url: string, endpoint: string) {
	if (new URL(url).searchParams.get("backgroundSyncProbe") === "1") {
		const { runNativeBackgroundSyncProbe } = await import(
			"./nativeBackgroundSyncProbe"
		);
		await runNativeBackgroundSyncProbe(endpoint);
		return;
	}
	const { runNativeGitProbe } = await import("./runNativeGitProbe");
	await runNativeGitProbe(endpoint);
}

function storageProbeAvailable() {
	const module = requireOptionalNativeModule<{
		nativeStorageQAEnabled?: boolean;
	}>("TolariaWorkspaceAccess");
	return nativeStorageQaEnabled(__DEV__, module?.nativeStorageQAEnabled);
}

function isLoopbackEndpoint(endpoint: string) {
	const url = new URL(endpoint);
	return (
		url.protocol === "http:" &&
		url.hostname === "127.0.0.1" &&
		url.pathname === "/"
	);
}
