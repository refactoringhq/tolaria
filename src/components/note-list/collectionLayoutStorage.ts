import { invoke } from "@tauri-apps/api/core";
import { isWebBuild } from "../../utils/webBuild";

type LayoutRecord = Record<string, unknown>;

const STORAGE_KEY = "tolaria:web-collection-layouts";

function readWebLayouts(): Record<string, LayoutRecord> {
	try {
		const stored = window.localStorage.getItem(STORAGE_KEY);
		if (!stored) return {};
		const parsed: unknown = JSON.parse(stored);
		return parsed !== null &&
			typeof parsed === "object" &&
			!Array.isArray(parsed)
			? (parsed as Record<string, LayoutRecord>)
			: {};
	} catch {
		return {};
	}
}

const layoutStore = isWebBuild()
	? {
			readLayouts: async () => readWebLayouts(),
			writeLayout: async (
				_vaultPath: string | undefined,
				key: string,
				record: LayoutRecord,
			) => {
				try {
					window.localStorage.setItem(
						STORAGE_KEY,
						JSON.stringify({ ...readWebLayouts(), [key]: record }),
					);
				} catch {
					// A browser storage quota or privacy setting should not interrupt changing views.
				}
			},
		}
	: {
			readLayouts: (vaultPath?: string) =>
				vaultPath
					? invoke<Record<string, LayoutRecord>>("list_collection_layouts", {
							vaultPath,
						})
					: Promise.resolve({}),
			writeLayout: (
				vaultPath: string | undefined,
				key: string,
				record: LayoutRecord,
			) =>
				invoke("save_collection_layout_cmd", {
					vaultPath,
					collection: key,
					presentation: record,
				}),
		};

export function readLayouts(
	vaultPath?: string,
): Promise<Record<string, LayoutRecord>> {
	return layoutStore.readLayouts(vaultPath);
}

export function writeLayout(
	vaultPath: string | undefined,
	key: string,
	record: LayoutRecord,
): Promise<unknown> {
	return layoutStore.writeLayout(vaultPath, key, record);
}
