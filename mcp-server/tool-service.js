import path from "node:path";
import * as instructions from "./agent-instructions.js";
import * as typeDefaults from "./type-instance-defaults.mjs";
import * as vault from "./vault.js";
import * as vaultPaths from "./vault-path.js";

export function createMcpToolService({
	resolveVaultPaths = () => vaultPaths.requireVaultPaths(),
	emitUiAction = () => {},
	attachVault: attachVaultOperation,
	cloneVault: cloneVaultOperation,
} = {}) {
	const sessionVaultPaths = [];

	function activeVaultPaths() {
		return [...new Set([...resolveVaultPaths(), ...sessionVaultPaths])];
	}

	async function registerVault(operation, args, registrationType) {
		if (!operation) throw new Error("Vault lifecycle operation is unavailable");
		const entry = await operation(args);
		if (!sessionVaultPaths.includes(entry.path))
			sessionVaultPaths.push(entry.path);
		emitUiAction("vault_registry_changed", {
			path: entry.path,
			registrationType,
		});
		return entry;
	}

	function attachVault(args = {}) {
		return registerVault(attachVaultOperation, args, "attach");
	}

	function cloneVault(args = {}) {
		return registerVault(cloneVaultOperation, args, "clone");
	}

	function requestedVaultPath(args = {}) {
		const requested =
			typeof args.vaultPath === "string" ? args.vaultPath.trim() : "";
		if (!requested) return null;
		if (!activeVaultPaths().includes(requested)) {
			throw new Error(`Vault is not active in Tolaria: ${requested}`);
		}
		return requested;
	}

	function resolveUiPath(args = {}) {
		const notePath = typeof args.path === "string" ? args.path : "";
		if (path.isAbsolute(notePath)) return notePath;
		const roots = activeVaultPaths();
		const vaultPath =
			requestedVaultPath(args) ?? (roots.length === 1 ? roots[0] : "");
		return vaultPath ? path.join(vaultPath, notePath) : notePath;
	}

	async function readNote(args = {}) {
		return getNoteFromActiveVaults(notePathArg(args), requestedVaultPath(args));
	}

	async function searchNotes(args = {}) {
		const requestedLimit =
			Number.isFinite(args.limit) && args.limit > 0 ? args.limit : 10;
		const results = [];

		for (const vaultPath of activeVaultPaths()) {
			const vaultResults = await vault.searchNotes(
				vaultPath,
				args.query,
				requestedLimit,
			);
			results.push(
				...vaultResults.map((result) => withVaultMetadata(result, vaultPath)),
			);
			if (results.length >= requestedLimit) break;
		}

		return results.slice(0, requestedLimit);
	}

	async function vaultContext(args = {}) {
		const targetVaultPath = requestedVaultPath(args);
		const roots = activeVaultPaths();
		if (targetVaultPath)
			return instructions.vaultContextWithInstructions(targetVaultPath);
		if (roots.length === 1)
			return instructions.vaultContextWithInstructions(roots[0]);

		return {
			vaults: await Promise.all(
				roots.map(instructions.vaultContextWithInstructions),
			),
		};
	}

	async function listVaults() {
		const vaults = await Promise.all(
			activeVaultPaths().map(async (vaultPath) => {
				const agentInstructions =
					await instructions.readAgentInstructions(vaultPath);
				return {
					path: vaultPath,
					label: vaultLabel(vaultPath),
					agentInstructionsPath: agentInstructions?.path ?? null,
					hasAgentInstructions: agentInstructions !== null,
				};
			}),
		);

		return { vaults };
	}

	async function createNote(args = {}) {
		const vaultPath = writableVaultPath(args);
		const notePath = writableNotePath(args, vaultPath);
		const content = await createNoteContent(args, vaultPath);
		const note = await vault.createNote(vaultPath, notePath, content);
		const targetPath = resolveUiPath({ ...args, path: note.path, vaultPath });
		emitUiAction("vault_changed", { path: targetPath });
		emitUiAction("open_tab", { path: targetPath });
		return { path: note.path, absolutePath: note.absolutePath, vaultPath };
	}

	async function updateNote(args = {}) {
		const { vaultPath, notePath } = await resolveWritableNote(args);
		const note = await vault.updateNote(
			vaultPath,
			notePath,
			noteContent(args),
			{
				expectedMtime: args.expectedMtime,
			},
		);
		emitUiAction("vault_changed", {
			path: resolveUiPath({ ...args, path: note.path, vaultPath }),
		});
		return {
			path: note.path,
			absolutePath: note.absolutePath,
			vaultPath,
			mtimeMs: note.mtimeMs,
		};
	}

	async function appendToNote(args = {}) {
		const { vaultPath, notePath } = await resolveWritableNote(args);
		const note = await vault.appendToNote(
			vaultPath,
			notePath,
			noteContent(args),
		);
		emitUiAction("vault_changed", {
			path: resolveUiPath({ ...args, path: note.path, vaultPath }),
		});
		return {
			path: note.path,
			absolutePath: note.absolutePath,
			vaultPath,
			mtimeMs: note.mtimeMs,
		};
	}

	async function resolveWritableNote(args = {}) {
		const vaultPath = writableVaultPath(args);
		const notePath = writableNotePath(args, vaultPath);
		return { vaultPath, notePath };
	}

	function openNoteAsTab(args = {}) {
		const targetPath = resolveUiPath(args);
		emitUiAction("vault_changed", { path: targetPath });
		emitUiAction("open_tab", { path: targetPath });
		return { targetPath };
	}

	function openNoteInEditor(args = {}) {
		const targetPath = resolveUiPath(args);
		emitUiAction("vault_changed", { path: targetPath });
		emitUiAction("open_note", { path: targetPath });
		return { targetPath };
	}

	function highlightEditor(args = {}) {
		emitUiAction("highlight", { element: args.element, path: args.path });
	}

	function setFilter(args = {}) {
		emitUiAction("set_filter", { filterType: args.type });
	}

	function refreshVault(args = {}) {
		emitUiAction("vault_changed", { path: resolveUiPath(args) });
	}

	async function getNoteFromActiveVaults(notePath, vaultPath = null) {
		const candidates = vaultPath ? [vaultPath] : activeVaultPaths();
		const matches = [];
		const errors = [];

		for (const candidate of candidates) {
			try {
				matches.push(
					withVaultMetadata(
						await vault.getNote(candidate, notePath),
						candidate,
					),
				);
			} catch (error) {
				errors.push(error);
			}
		}

		if (matches.length === 1) return matches[0];
		if (matches.length > 1) {
			throw new Error(
				`Note path is ambiguous across active vaults. Pass vaultPath for ${notePath}.`,
			);
		}
		throw errors[0] ?? new Error(`Note not found: ${notePath}`);
	}

	function writableVaultPath(args = {}) {
		const requested = requestedVaultPath(args);
		if (requested) return requested;

		const roots = activeVaultPaths();
		const notePath = notePathArg(args);
		if (path.isAbsolute(notePath)) {
			const root = roots.find((vaultPath) =>
				isInsideVaultRoot(vaultPath, notePath),
			);
			if (root) return root;
		}
		if (roots.length === 1) return roots[0];
		throw new Error(
			`Note path is ambiguous across active vaults. Pass vaultPath for ${notePath}.`,
		);
	}

	return {
		activeVaultPaths,
		appendToNote,
		attachVault,
		cloneVault,
		createNote,
		highlightEditor,
		listVaults,
		openNoteAsTab,
		openNoteInEditor,
		readNote,
		refreshVault,
		requestedVaultPath,
		resolveUiPath,
		searchNotes,
		setFilter,
		updateNote,
		vaultContext,
	};
}

function writableNotePath(args, vaultPath) {
	const notePath = notePathArg(args);
	if (!path.isAbsolute(notePath) || !isInsideVaultRoot(vaultPath, notePath))
		return notePath;
	return path.relative(vaultPath, notePath);
}

function withVaultMetadata(note, vaultPath) {
	return {
		...note,
		vaultPath,
		vaultLabel: vaultLabel(vaultPath),
	};
}

function vaultLabel(vaultPath) {
	return path.basename(vaultPath) || vaultPath;
}

function isInsideVaultRoot(vaultPath, notePath) {
	const relative = path.relative(vaultPath, notePath);
	return (
		Boolean(relative) &&
		!relative.startsWith("..") &&
		!path.isAbsolute(relative)
	);
}

function notePathArg(args = {}) {
	const notePath = typeof args.path === "string" ? args.path.trim() : "";
	if (!notePath) throw new Error("Note path is required");
	return notePath;
}

function yamlScalar(value) {
	return JSON.stringify(value);
}

function trimmedString(value) {
	return typeof value === "string" ? value.trim() : "";
}

async function fallbackCreateNoteContent(args, vaultPath) {
	const title =
		trimmedString(args.title) || path.basename(notePathArg(args), ".md");
	const type = trimmedString(args.type) || trimmedString(args.is_a) || "Note";
	const defaults = await typeDefaults.typeDefaultLines({
		vaultPath,
		typeName: type,
	});
	const frontmatter = [`type: ${yamlScalar(type)}`, ...defaults].join("\n");
	return `---\n${frontmatter}\n---\n\n# ${title}\n`;
}

async function createNoteContent(args, vaultPath) {
	return typeof args.content === "string" && args.content.trim()
		? args.content
		: fallbackCreateNoteContent(args, vaultPath);
}

function noteContent(args = {}) {
	if (typeof args.content === "string" && args.content.length > 0)
		return args.content;
	throw new Error("content is required");
}
