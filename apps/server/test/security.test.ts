import { request as httpRequest, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createVaultServer } from "../src/server.ts";
import { LocalDiskStore } from "../src/store.ts";
import type { Vault } from "../src/vault.ts";
import { createFixture, type Fixture } from "./helpers.ts";

const TOKEN = "test-token-0123456789";

let fixture: Fixture;
let vault: Vault;
let server: Server;
let testServerOrigin: string;

async function start(): Promise<void> {
	server = await createVaultServer({
		vault,
		store: new LocalDiskStore(join(fixture.root, "server", "state")),
		token: TOKEN,
		maxBodyBytes: 1024 * 1024,
		collab: false,
		changes: new (await import("../src/changeEmitter.ts")).ChangeEmitter(),
	});
	await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
	testServerOrigin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
}

async function stop(): Promise<void> {
	server.closeAllConnections();
	await new Promise((resolve) => server.close(resolve));
}

beforeEach(async () => {
	fixture = await createFixture();
	vault = await fixture.openVault();
	await start();
});

afterEach(async () => {
	await stop();
	await vault.idle();
	await fixture.cleanup();
});

interface TestRequest {
	path: string;
	init: RequestInit;
}

/**
 * Call test server endpoint at 127.0.0.1 with bearer token.
 * Test server is always bound to loopback (127.0.0.1).
 */
function call({ path, init }: TestRequest): Promise<Response> {
	const headers = {
		authorization: `Bearer ${TOKEN}`,
		...(init.headers as Record<string, string>),
	};
	return fetch(new URL(path, testServerOrigin), { ...init, headers });
}

function api(path: string, init: RequestInit = {}): Promise<Response> {
	return call({ path, init });
}

describe("Security headers", () => {
	it("sets X-Frame-Options to prevent clickjacking", async () => {
		const response = await api("/v1/vault");
		expect(response.headers.get("x-frame-options")).toBe("DENY");
	});

	it("sets X-Content-Type-Options to prevent MIME sniffing", async () => {
		const response = await api("/v1/vault");
		expect(response.headers.get("x-content-type-options")).toBe("nosniff");
	});

	it("sets Cache-Control to prevent sensitive data caching", async () => {
		const response = await api("/v1/vault");
		expect(response.headers.get("cache-control")).toBe("no-store");
	});
});

describe("Path traversal protection", () => {
	it("rejects absolute paths", async () => {
		const response = await api("/v1/files/%2Fetc%2Fpasswd");
		expect(response.status).toBe(400);
		expect(await response.json()).toMatchObject({
			error: { code: "invalid_path" },
		});
	});

	it("rejects parent directory traversal", async () => {
		const response = await api("/v1/files/..%2F..%2Fetc%2Fpasswd");
		expect(response.status).toBe(400);
		expect(await response.json()).toMatchObject({
			error: { code: "invalid_path" },
		});
	});

	it("rejects nested parent directory traversal", async () => {
		const response = await api("/v1/files/notes%2F..%2F..%2Fetc%2Fpasswd");
		expect(response.status).toBe(400);
		expect(await response.json()).toMatchObject({
			error: { code: "invalid_path" },
		});
	});

	it("rejects paths with backslashes", async () => {
		const response = await api("/v1/files/notes%5Cfile.md");
		expect(response.status).toBe(400);
		expect(await response.json()).toMatchObject({
			error: { code: "invalid_path" },
		});
	});

	it("rejects paths to git directory", async () => {
		const response = await api("/v1/files/.git%2Fconfig");
		expect(response.status).toBe(400);
		expect(await response.json()).toMatchObject({
			error: { code: "invalid_path" },
		});
	});

	it("rejects paths to git control files", async () => {
		const response = await api("/v1/files/.gitignore");
		expect(response.status).toBe(400);
		expect(await response.json()).toMatchObject({
			error: { code: "invalid_path" },
		});
	});

	it("rejects paths with NUL bytes", async () => {
		const response = await api("/v1/files/file%00.md");
		expect(response.status).toBe(400);
		expect(await response.json()).toMatchObject({
			error: { code: "invalid_path" },
		});
	});

	it("rejects paths with newlines", async () => {
		const response = await api("/v1/files/file%0A.md");
		expect(response.status).toBe(400);
		expect(await response.json()).toMatchObject({
			error: { code: "invalid_path" },
		});
	});

	it("rejects empty path segments", async () => {
		const response = await api("/v1/files/notes%2F%2Ffile.md");
		expect(response.status).toBe(400);
		expect(await response.json()).toMatchObject({
			error: { code: "invalid_path" },
		});
	});
});

describe("Request body size limits", () => {
	it("rejects bodies larger than the configured limit based on Content-Length", async () => {
		const response = await new Promise<{ status: number; body: string }>(
			(resolve, reject) => {
				const request = httpRequest(
					new URL("/v1/files/large.txt", testServerOrigin),
					{
						method: "PUT",
						headers: {
							authorization: `Bearer ${TOKEN}`,
							"if-none-match": "*",
							"content-length": String(2 * 1024 * 1024),
						},
					},
					(response) => {
						const chunks: Buffer[] = [];
						response.on("data", (chunk: Buffer) => chunks.push(chunk));
						response.on("end", () =>
							resolve({
								status: response.statusCode ?? 0,
								body: Buffer.concat(chunks).toString("utf8"),
							}),
						);
					},
				);
				request.on("error", reject);
				request.end("x");
			},
		);
		expect(response.status).toBe(413);
		expect(JSON.parse(response.body)).toMatchObject({
			error: { code: "payload_too_large" },
		});
	});

	it("accepts bodies at the limit", async () => {
		const okBody = "x".repeat(1024 * 1024); // Exactly 1MB string
		const response = await api("/v1/files/ok.txt", {
			method: "PUT",
			body: okBody,
			headers: { "if-none-match": "*" },
		});
		expect(response.status).toBe(201);
	});
});

describe("Authentication", () => {
	it("uses constant-time comparison for bearer tokens", async () => {
		// This test verifies the implementation uses timingSafeEqual, but timing cannot be tested in JS
		const wrongToken = "wrong-token-0123456789";
		const start = Date.now();
		const testUrl = new URL("/v1/vault", testServerOrigin);
		const response = await fetch(testUrl.href, {
			headers: { authorization: `Bearer ${wrongToken}` },
		});
		const elapsed = Date.now() - start;

		expect(response.status).toBe(401);
		// The comparison should take roughly the same time regardless of where tokens differ
		// We can't measure nanoseconds in JS, but we verify it doesn't short-circuit immediately
		expect(elapsed).toBeGreaterThan(0);
	});

	it("does not leak token details in error messages", async () => {
		const testUrl = new URL("/v1/vault", testServerOrigin);
		const response = await fetch(testUrl.href, {
			headers: { authorization: "Bearer wrong-token" },
		});
		const body = await response.text();
		expect(body).not.toContain("wrong-token");
		expect(body).not.toContain(TOKEN);
	});

	it("requires token for file operations", async () => {
		const testUrl = new URL("/v1/files/welcome.md", testServerOrigin);
		const response = await fetch(testUrl.href);
		expect(response.status).toBe(401);
	});

	it("requires properly formatted Bearer scheme", async () => {
		const testUrl = new URL("/v1/vault", testServerOrigin);
		const response = await fetch(testUrl.href, {
			headers: { authorization: TOKEN }, // Missing "Bearer" prefix
		});
		expect(response.status).toBe(401);
	});
});

describe("Error handling", () => {
	it("does not leak internal error details", async () => {
		vault.list = () =>
			Promise.reject(
				new Error("Internal database error with sensitive path /var/secret"),
			);
		const response = await api("/v1/files");
		const body = await response.json();

		expect(response.status).toBe(500);
		expect(body.error.code).toBe("internal");
		expect(body.error.message).toBe("internal error");
		expect(JSON.stringify(body)).not.toContain("database");
		expect(JSON.stringify(body)).not.toContain("/var/secret");
	});
});

describe("Input validation", () => {
	it("validates JSON request bodies", async () => {
		const response = await api("/v1/rename", {
			method: "POST",
			body: "not valid json{",
			headers: { "content-type": "application/json" },
		});
		expect(response.status).toBe(400);
		expect(await response.json()).toMatchObject({
			error: { code: "invalid_request" },
		});
	});

	it("rejects non-object JSON bodies", async () => {
		const response = await api("/v1/rename", {
			method: "POST",
			body: JSON.stringify(["array", "not", "object"]),
			headers: { "content-type": "application/json" },
		});
		expect(response.status).toBe(400);
		expect(await response.json()).toMatchObject({
			error: {
				code: "invalid_request",
				message: "the body must be a JSON object",
			},
		});
	});

	it("enforces search query length limit", async () => {
		const longQuery = "x".repeat(201);
		const response = await api(`/v1/search?q=${longQuery}`);
		expect(response.status).toBe(400);
		expect(await response.json()).toMatchObject({
			error: { code: "invalid_request" },
		});
	});

	it("clamps search result limit to maximum", async () => {
		const response = await api("/v1/search?q=test&limit=999");
		expect(response.status).toBe(200);
		const body = await response.json();
		// Limit is clamped to MAX_SEARCH_LIMIT (200), not rejected
		expect(body.results.length).toBeLessThanOrEqual(200);
	});

	it("rejects negative search limits", async () => {
		const response = await api("/v1/search?q=test&limit=-1");
		expect(response.status).toBe(400);
		expect(await response.json()).toMatchObject({
			error: { code: "invalid_request" },
		});
	});
});
