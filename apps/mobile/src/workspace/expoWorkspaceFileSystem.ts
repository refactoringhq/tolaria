import type { Directory, File, Paths } from "expo-file-system";
import {
	normalizedWorkspaceRelativePath,
	type WorkspaceFileSystem,
} from "./fileSystemWorkspaceRepository";
import { assertGitCheckoutComplete } from "./git/gitCheckoutGuard";
import {
	type LocalVaultFile,
	mobileFileKindForPath,
} from "./localVaultSnapshot";
import {
	parseMobileVaultConfig,
	serializeMobileVaultConfig,
} from "./mobileVaultConfig";
import { changeNativeWorkspaceEntry } from "./workspaceEntryRecovery";
import {
	nativeWorkspaceTextBatchWriter,
	recoverNativeWorkspaceText,
	writeNativeWorkspaceText,
} from "./workspaceTextRecovery";
import { requireWorkspaceWritePath } from "./workspaceWriteValidation";

type ExpoFileSystemModule = {
	Directory: typeof Directory;
	File: typeof File;
	Paths: typeof Paths;
};
type DirectoryName = string;
type RelativeVaultPath = string;
type RootUri = string;

declare const require: (moduleName: string) => ExpoFileSystemModule;

let expoFileSystemModule: ExpoFileSystemModule | null = null;

export const expoWorkspaceFileSystem: WorkspaceFileSystem = {
	get writeTextBatch() {
		return nativeWorkspaceTextBatchWriter();
	},
	recoverPendingWrites: (rootUri) => {
		assertGitCheckoutComplete(expoFileSystem(), rootUri);
		return recoverNativeWorkspaceText(rootUri);
	},
	createDirectory: (rootUri, relativePath) => {
		const normalizedPath = requireWorkspaceWritePath(relativePath);

		workspaceDirectory(expoFileSystem(), rootUri, normalizedPath).create({
			idempotent: true,
			intermediates: true,
		});
	},
	deleteDirectory: (rootUri, relativePath) => {
		deleteWorkspaceEntry(rootUri, relativePath, true);
	},
	deleteTextFile: (rootUri, relativePath) => {
		deleteWorkspaceEntry(rootUri, relativePath, false);
	},
	moveDirectory: (rootUri, fromRelativePath, toRelativePath) => {
		return moveWorkspaceEntry(rootUri, fromRelativePath, toRelativePath, true);
	},
	moveTextFile: (rootUri, fromRelativePath, toRelativePath) => {
		return moveWorkspaceEntry(rootUri, fromRelativePath, toRelativePath, false);
	},
	readVaultConfig: (rootUri) => {
		const file = vaultConfigFile(expoFileSystem(), rootUri);
		return file.exists ? parseMobileVaultConfig(file.textSync()) : null;
	},
	readTextFile: (rootUri, relativePath) => {
		const normalizedPath = normalizedWorkspaceRelativePath(relativePath);
		if (!normalizedPath) return null;

		const file = workspaceFile(expoFileSystem(), rootUri, normalizedPath);
		return file.exists ? file.textSync() : null;
	},
	readTextFileAsync: (rootUri, relativePath) =>
		readWorkspaceTextFileAsync(expoFileSystem(), rootUri, relativePath),
	readVaultFiles: (rootUri) => {
		const module = expoFileSystem();
		assertGitCheckoutComplete(module, rootUri);
		recoverNativeWorkspaceText(rootUri);
		const root = new module.Directory(rootUri);
		if (!root.exists) throw new Error("workspaceRootMissing");

		return readDirectoryFiles(module, root, "");
	},
	readVaultDirectories: (rootUri) => {
		const module = expoFileSystem();
		assertGitCheckoutComplete(module, rootUri);
		recoverNativeWorkspaceText(rootUri);
		const root = new module.Directory(rootUri);
		if (!root.exists) throw new Error("workspaceRootMissing");

		return readDirectoryPaths(module, root, "");
	},
	writeTextFile: (rootUri, relativePath, content) => {
		const normalizedPath = requireWorkspaceWritePath(relativePath);

		const file = workspaceFile(expoFileSystem(), rootUri, normalizedPath);
		const nativeWrite = writeNativeWorkspaceText(
			rootUri,
			normalizedPath,
			content,
		);
		if (nativeWrite) return nativeWrite;
		file.parentDirectory.create({ idempotent: true, intermediates: true });
		if (!file.exists) file.create({ intermediates: true });
		file.write(content, { encoding: "utf8" });
	},
	writeVaultConfig: (rootUri, config) => {
		const file = vaultConfigFile(expoFileSystem(), rootUri);
		file.parentDirectory.create({ idempotent: true, intermediates: true });
		const content = serializeMobileVaultConfig(config);
		const nativeWrite = writeNativeWorkspaceText(
			file.parentDirectory.uri,
			file.name,
			content,
		);
		if (nativeWrite) return nativeWrite;
		if (!file.exists) file.create({ intermediates: true });
		file.write(content, { encoding: "utf8" });
	},
};

function expoFileSystem(): ExpoFileSystemModule {
	expoFileSystemModule ??= require("expo-file-system");
	return expoFileSystemModule;
}

export async function readWorkspaceTextFileAsync(
	module: ExpoFileSystemModule,
	rootUri: RootUri,
	relativePath: RelativeVaultPath,
): Promise<string | null> {
	const normalizedPath = normalizedWorkspaceRelativePath(relativePath);
	if (!normalizedPath) return null;

	const file = workspaceFile(module, rootUri, normalizedPath, false);
	return file.exists ? file.text() : null;
}

function moveWorkspaceEntry(
	rootUri: RootUri,
	fromRelativePath: RelativeVaultPath,
	toRelativePath: RelativeVaultPath,
	directory: boolean,
) {
	const fromPath = requireWorkspaceWritePath(fromRelativePath);
	const toPath = requireWorkspaceWritePath(toRelativePath);
	const nativeChange = changeNativeWorkspaceEntry(rootUri, {
		path: fromPath,
		toPath,
		directory,
	});
	if (nativeChange) return nativeChange;

	const module = expoFileSystem();
	const entryForPath = directory ? workspaceDirectory : workspaceFile;
	const source = entryForPath(module, rootUri, fromPath);
	const destination = entryForPath(module, rootUri, toPath);
	if (!source.exists) throw new Error("workspaceMoveSourceMissing");
	if (fromPath === toPath) return;
	if (destination.exists) throw new Error("workspaceMoveDestinationExists");

	destination.parentDirectory.create({ idempotent: true, intermediates: true });
	source.move(destination);
}

function deleteWorkspaceEntry(
	rootUri: RootUri,
	relativePath: RelativeVaultPath,
	directory: boolean,
) {
	const normalizedPath = requireWorkspaceWritePath(relativePath);
	const nativeChange = changeNativeWorkspaceEntry(rootUri, {
		path: normalizedPath,
		directory,
	});
	if (nativeChange) return nativeChange;

	const module = expoFileSystem();
	const entry = directory
		? workspaceDirectory(module, rootUri, normalizedPath)
		: workspaceFile(module, rootUri, normalizedPath);
	if (entry.exists) entry.delete();
}

function readDirectoryFiles(
	module: ExpoFileSystemModule,
	directory: Directory,
	currentRelativePath: RelativeVaultPath,
): LocalVaultFile[] {
	const files: LocalVaultFile[] = [];

	for (const entry of directory.list()) {
		const relativePath = joinedRelativePath(currentRelativePath, entry.name);
		if (entry instanceof module.Directory && shouldReadDirectory(entry.name)) {
			files.push(...readDirectoryFiles(module, entry, relativePath));
		} else if (entry instanceof module.File && shouldReadFile(relativePath)) {
			files.push(localVaultFile(entry, relativePath));
		}
	}

	return files;
}

function readDirectoryPaths(
	module: ExpoFileSystemModule,
	directory: Directory,
	currentRelativePath: RelativeVaultPath,
): RelativeVaultPath[] {
	const directories: RelativeVaultPath[] = [];

	for (const entry of directory.list()) {
		const relativePath = joinedRelativePath(currentRelativePath, entry.name);
		if (entry instanceof module.Directory && shouldReadDirectory(entry.name)) {
			directories.push(
				relativePath,
				...readDirectoryPaths(module, entry, relativePath),
			);
		}
	}

	return directories;
}

export function localVaultFile(
	file: File,
	relativePath: RelativeVaultPath,
): LocalVaultFile {
	const info = file.info();
	let fileKind = mobileFileKindForPath(relativePath);
	let content = "";
	if (fileKind !== "binary") {
		const bytes = file.bytesSync();
		try {
			content = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
		} catch (error) {
			if (!(error instanceof TypeError)) throw error;
			fileKind = "binary";
		}
	}

	return {
		absolutePath: file.uri,
		content,
		createdAt: localFileTime(info.creationTime, () => file.creationTime),
		fileKind,
		modifiedAt: localFileTime(
			info.modificationTime,
			() => file.modificationTime,
		),
		relativePath,
		size: info.size ?? content.length,
	};
}

function localFileTime(
	primary: number | null | undefined,
	fallback: () => number | null,
) {
	return primary ?? fallback() ?? null;
}

function workspaceFile(
	module: ExpoFileSystemModule,
	rootUri: RootUri,
	relativePath: RelativeVaultPath,
	recover = true,
): File {
	return workspaceEntry(module, rootUri, relativePath, module.File, recover);
}

function workspaceDirectory(
	module: ExpoFileSystemModule,
	rootUri: RootUri,
	relativePath: RelativeVaultPath,
): Directory {
	return workspaceEntry(module, rootUri, relativePath, module.Directory);
}

function workspaceEntry<Entry extends File | Directory>(
	module: ExpoFileSystemModule,
	rootUri: RootUri,
	relativePath: RelativeVaultPath,
	Entry: new (root: string, ...segments: string[]) => Entry,
	recover = true,
): Entry {
	assertGitCheckoutComplete(module, rootUri);
	if (recover) recoverNativeWorkspaceText(rootUri);
	return new Entry(rootUri, ...relativePath.split("/"));
}

function vaultConfigFile(module: ExpoFileSystemModule, rootUri: RootUri): File {
	assertGitCheckoutComplete(module, rootUri);
	const directory = new module.Directory(
		module.Paths.document,
		".tolaria-mobile-config",
	);
	recoverNativeWorkspaceText(directory.uri);
	return new module.File(
		directory.uri,
		`${stableVaultConfigName(rootUri)}.json`,
	);
}

function stableVaultConfigName(rootUri: RootUri): string {
	let hash = 2_166_136_261;
	for (let index = 0; index < rootUri.length; index += 1) {
		hash ^= rootUri.charCodeAt(index);
		hash = Math.imul(hash, 16_777_619);
	}

	return `vault-${(hash >>> 0).toString(36)}`;
}

function joinedRelativePath(
	parent: RelativeVaultPath,
	name: DirectoryName,
): RelativeVaultPath {
	return parent ? `${parent}/${name}` : name;
}

function shouldReadFile(relativePath: RelativeVaultPath): boolean {
	return Boolean(relativePath.split("/").at(-1));
}

function shouldReadDirectory(name: DirectoryName): boolean {
	return !name.startsWith(".") && name !== "node_modules";
}
