import { parse as parseYaml } from "yaml";
import type { ViewFile } from "../../../src/types";
import { normalizeViewFiles } from "../../../src/utils/vaultMetadataNormalization";
import { ROUTES } from "../../protocol/src/index.ts";
import { ok, type Request } from "./remoteHttp";

type RemoteFileReader = (path: string) => Promise<{ content: string }>;

interface ListedFilesResponse {
	files?: { path?: unknown }[];
}

/** Reads saved-view YAML files from the same remote vault used for note entries. */
export async function listRemoteViews(
	request: Request,
	readRemoteFile: RemoteFileReader,
): Promise<ViewFile[]> {
	const response = await ok(await request(`${ROUTES.files}?prefix=views/`));
	const body = (await response.json()) as ListedFilesResponse;
	const paths = (body.files ?? [])
		.map((file) => file.path)
		.filter(isSavedViewPath);
	const parsed = await Promise.all(
		paths.map((path) => parseRemoteView(path, readRemoteFile)),
	);
	const views = normalizeViewFiles(parsed.filter((view) => view !== null));
	return views.sort(compareViews);
}

function isSavedViewPath(path: unknown): path is string {
	if (typeof path !== "string" || !path.startsWith("views/")) return false;
	const filename = path.slice("views/".length);
	return !filename.includes("/") && hasYamlExtension(filename);
}

function hasYamlExtension(filename: string): boolean {
	return filename.endsWith(".yml") || filename.endsWith(".yaml");
}

async function parseRemoteView(
	path: string,
	readRemoteFile: RemoteFileReader,
): Promise<unknown | null> {
	try {
		const file = await readRemoteFile(path);
		const definition: unknown = parseYaml(file.content);
		if (isViewDefinitionRecord(definition)) {
			return { filename: path.slice("views/".length), definition };
		}
	} catch {
		// The desktop skips malformed saved views and leaves them untouched in the vault.
	}
	return null;
}

function isViewDefinitionRecord(
	value: unknown,
): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function compareViews(left: ViewFile, right: ViewFile): number {
	const orderDifference =
		(left.definition.order ?? Number.MAX_SAFE_INTEGER) -
		(right.definition.order ?? Number.MAX_SAFE_INTEGER);
	return orderDifference || left.filename.localeCompare(right.filename);
}
