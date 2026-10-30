import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { request } from "node:http";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { createServer } from "vite";
import { vaultApiPlugin } from "./vault-api-plugin.ts";

function sendRequest({ port, route, args = {}, method = "POST" }) {
	const routePath =
		method === "GET" ? `${route}?${new URLSearchParams(args)}` : route;
	return new Promise((resolve, reject) => {
		const req = request(
			{
				hostname: "127.0.0.1",
				port,
				path: routePath,
				method,
				headers: { "Content-Type": "application/json" },
			},
			(res) => {
				let body = "";
				res.on("data", (chunk) => {
					body += chunk.toString();
				});
				res.on("end", () =>
					resolve({ status: res.statusCode, body: JSON.parse(body) }),
				);
				res.on("error", reject);
			},
		);
		req.on("error", reject);
		req.end(method === "GET" ? undefined : JSON.stringify(args));
	});
}

async function withVault(check) {
	const vault = await mkdtemp(path.join(os.tmpdir(), "tolaria-api-test-"));
	const server = await createServer({
		configFile: false,
		plugins: [vaultApiPlugin()],
		optimizeDeps: { noDiscovery: true, include: [] },
		server: { host: "127.0.0.1", port: 0 },
	});
	try {
		await server.listen();
		const { port } = server.httpServer.address();
		const note = path.join(vault, "original.md");
		const link = path.join(vault, "link.md");
		const content = "---\nstatus: active\n---\n# Original\nBody text\n";
		const api = (route, args, method) =>
			sendRequest({ port, route, args, method });
		await api("/api/vault/save", { path: note, content });
		await api("/api/vault/save", {
			path: link,
			content: "# Links\n[[Original|label]] [[original]]\n",
		});
		await check({
			vault,
			note,
			link,
			content,
			api,
		});
	} catch (error) {
		throw new Error(`Dev vault contract check failed: ${error.message}`, {
			cause: error,
		});
	} finally {
		await server.close();
		await rm(vault, { recursive: true, force: true });
	}
}

test("dev vault read routes support GET and POST", () =>
	withVault(async ({ api, vault, note, content }) => {
		assert.equal((await api("/api/vault/ping", {}, "GET")).body.ok, true);
		for (const method of ["GET", "POST"]) {
			assert.equal(
				(await api("/api/vault/content", { path: note }, method)).body.content,
				content,
			);
			assert.equal(
				(await api("/api/vault/list", { path: vault }, method)).body.length,
				2,
			);
			assert.equal(
				(await api("/api/vault/entry", { path: note }, method)).body.title,
				"Original",
			);
			assert.equal(
				new Map(
					Object.entries(
						(await api("/api/vault/all-content", { path: vault }, method)).body,
					),
				).get(note),
				content,
			);
			assert.equal(
				(
					await api(
						"/api/vault/search",
						{ vault_path: vault, query: "Body" },
						method,
					)
				).body.results.length,
				1,
			);
		}
	}));

test("dev vault note timestamps are seconds", () =>
	withVault(async ({ api, note }) => {
		const { body } = await api("/api/vault/entry", { path: note }, "GET");
		const nowInSeconds = Date.now() / 1000;

		for (const timestamp of [body.modifiedAt, body.createdAt]) {
			assert.ok(
				timestamp > nowInSeconds - 60 && timestamp < nowInSeconds + 60,
				`expected a timestamp in seconds near ${nowInSeconds}, received ${timestamp}`,
			);
		}
	}));

test("dev vault renames preserve legacy target handling and save/delete responses", () =>
	withVault(async ({ api, vault, note, link }) => {
		const renamed = await api("/api/vault/rename", {
			old_path: note,
			new_title: "Updated",
			vault_path: vault,
		});
		assert.equal(renamed.body.updated_files, 1);
		assert.equal(
			(await api("/api/vault/content", { path: link }, "GET")).body.content,
			"# Links\n[[updated|label]] [[original]]\n",
		);
		const moved = await api("/api/vault/rename-filename", {
			old_path: renamed.body.new_path,
			new_filename_stem: "moved",
			vault_path: vault,
		});
		assert.equal(moved.body.updated_files, 1);
		assert.equal(
			(await api("/api/vault/content", { path: link }, "GET")).body.content,
			"# Links\n[[moved|label]] [[original]]\n",
		);
		assert.equal(
			(
				await api("/api/vault/save", {
					path: moved.body.new_path,
					content: "# Saved",
				})
			).body,
			null,
		);
		assert.equal(
			(
				await api("/api/vault/command", {
					cmd: "get_note_content",
					args: { path: moved.body.new_path },
				})
			).body.content,
			"# Saved",
		);
		assert.equal(
			(await api("/api/vault/delete", { path: moved.body.new_path })).body,
			moved.body.new_path,
		);
	}));

test("dev vault error responses preserve status codes", () =>
	withVault(async ({ api }) => {
		assert.equal((await api("/api/vault/content", {})).status, 400);
		assert.equal((await api("/api/vault/content", {}, "PUT")).status, 405);
		assert.equal(
			(await api("/api/vault/command", { cmd: "unsupported", args: {} }))
				.status,
			404,
		);
		assert.equal((await api("/api/vault/command", {})).status, 400);
		assert.equal((await api("/api/vault/save", {})).status, 400);
		assert.equal((await api("/api/vault/delete", {})).status, 400);
	}));
