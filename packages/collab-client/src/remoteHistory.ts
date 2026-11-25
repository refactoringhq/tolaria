import {
	HISTORY_CHECKPOINT_PARAM,
	type NoteCheckpoint,
	type NoteHistoryResponse,
	ROUTES,
	type RestoreRequest,
	type WriteResult,
} from "../../protocol/src/index.ts";
import {
	assertVaultPath,
	encoded,
	malformed,
	ok,
	type Request,
} from "./remoteHttp.ts";

/**
 * A note's checkpoints on the Tolaria remote (protocol 1.11, TOL-421): list them, read one,
 * and restore one, which the server stores as a new checkpoint. Checkpoint ids are opaque.
 */
export interface RemoteNoteHistory {
	/** Newest first. */
	list(path: string): Promise<NoteCheckpoint[]>;
	/** The note's content at the checkpoint. */
	read(path: string, checkpoint: string): Promise<string>;
	/** `unchanged` when the note already had that content: no new checkpoint was made. */
	restore(path: string, checkpoint: string): Promise<RestoreOutcome>;
}

export type RestoreOutcome = "restored" | "unchanged";

const CHECKPOINT_FIELDS = ["id", "time", "author", "message"] as const;

function isCheckpoint(value: unknown): value is NoteCheckpoint {
	const record = value as Record<string, unknown> | null;
	return CHECKPOINT_FIELDS.every(
		(field) => typeof record?.[field] === "string",
	);
}

function checkpointsOf(body: unknown): NoteCheckpoint[] {
	const { checkpoints } = (body ?? {}) as Partial<NoteHistoryResponse>;
	if (Array.isArray(checkpoints) && checkpoints.every(isCheckpoint))
		return checkpoints;
	throw malformed("note history");
}

function outcomeOf(body: unknown): RestoreOutcome {
	const { outcome } = (body ?? {}) as Partial<WriteResult>;
	if (typeof outcome !== "string") throw malformed("restore answer");
	return outcome === "unchanged" ? "unchanged" : "restored";
}

function historyPath(path: string): string {
	assertVaultPath(path);
	return `${ROUTES.history}/${encoded(path)}`;
}

export function remoteHistory(request: Request): RemoteNoteHistory {
	return {
		async list(path) {
			const response = await ok(await request(historyPath(path)));
			return checkpointsOf(await response.json().catch(() => null));
		},
		async read(path, checkpoint) {
			const query = `${HISTORY_CHECKPOINT_PARAM}=${encodeURIComponent(checkpoint)}`;
			const response = await ok(
				await request(`${historyPath(path)}?${query}`),
			);
			return response.text();
		},
		async restore(path, checkpoint) {
			assertVaultPath(path);
			const body: RestoreRequest = { path, checkpoint };
			const init = {
				method: "POST",
				body: JSON.stringify(body),
				headers: { "content-type": "application/json" },
			};
			const response = await ok(await request(ROUTES.restore, init));
			return outcomeOf(await response.json().catch(() => null));
		},
	};
}
