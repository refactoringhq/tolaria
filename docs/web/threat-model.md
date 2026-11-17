---
type: Note
_organized: true
---

# Tolaria Web Security Threat Model

**Scope:** This document covers the open-source components in the `refactoringhq/tolaria` repository:
- `apps/server` - AGPL vault/sync server (file API, Yjs collaboration websocket, blob storage)
- `apps/web` - Web client build
- Shared VaultBackend/remote client code

**Out of scope:** Private components in `refactoringhq/tolaria-cloud` (front Worker, accounts/auth, sessions, GitHub App, routing) are covered in a separate security review.

## Architecture Overview

The Tolaria web architecture consists of:

1. **Server** (`apps/server`): Node.js HTTP server that manages:
   - File API (REST-style vault operations)
   - Git-backed storage with automatic sync
   - Yjs-based real-time collaboration via WebSocket
   - Doc index and snapshots (persisted to blob store)
   - Server-side search

2. **Web Client** (`apps/web`): Browser-based interface for real-time collaboration

3. **Deployment**: Each vault runs in its own Container behind a Cloudflare Worker (from `tolaria-cloud`), fronted by Cloudflare Access at `tolaria.lucaron.in`

## Assets

1. **Vault content** (notes, attachments, git history)
2. **Bearer tokens** (server authentication)
3. **Collaboration tickets** (short-lived WebSocket auth)
4. **Y.Doc snapshots** and doc indices (derived server state)
5. **Server availability** (DoS/resource exhaustion)
6. **R2/S3 credentials** (when using R2 blob store)

## Trust Boundaries

1. **Client → Server**: All requests cross this boundary; bearer token or ticket required
2. **Server → Git remote**: Server syncs to authenticated remote
3. **Server → Blob store**: Server persists doc index/snapshots to local disk or R2
4. **Cloudflare Worker → Container**: Worker validates auth and routes to container (out of scope: in `tolaria-cloud`)

## Attacker Models

1. **Unauthenticated network attacker**: No valid bearer token
2. **Authenticated client (read-only)**: Valid ticket with `read` access
3. **Authenticated client (write)**: Valid bearer token or `write` ticket
4. **Malicious collaborator**: Authenticated user attempting to disrupt other users or corrupt vault
5. **Container escape**: Attacker with code execution in container attempting to access other vaults or host resources

## Security Analysis by Area

### 1. Path Traversal

**Implementation:** `apps/server/src/paths.ts`

The `vaultPath()` function validates all client-supplied paths with strict rules:

**Protections in place:**
- ✅ Rejects absolute paths (starting with `/`)
- ✅ Rejects `..` parent directory segments
- ✅ Rejects `.` segments
- ✅ Rejects empty segments (e.g., `a//b`)
- ✅ Rejects paths starting with `.git` (case-insensitive)
- ✅ Rejects backslashes
- ✅ Rejects control characters (< 0x20, 0x7F including newlines, NUL)
- ✅ Enforces 1024-byte length limit
- ✅ Git clone configured with `core.symlinks=false` to prevent symlink traversal
- ✅ All operations use validated `VaultPath` type
- ✅ File operations use `node:path.join()` which normalizes paths
- ✅ Git operations use `--` separator to prevent path-as-option interpretation

**Risk assessment:** **LOW**
- Comprehensive validation with defense in depth
- Negative tests cover all attack vectors
- Symlink protection at git level

**Recommendations:**
- None; implementation is sound

### 2. Ticket and Token Security

**Implementation:** `apps/server/src/collab/tickets.ts`, `apps/server/src/httpIo.ts`

**Bearer tokens:**
- Required for all file API operations
- Validated using constant-time comparison (`timingSafeEqual` on SHA-256 digests)
- Minimum length: 16 characters
- Sent via `Authorization: Bearer <token>` header
- Never logged or exposed in errors

**Agent tokens (protocol 1.11, ADR 0304):** `apps/server/src/agentTokens.ts`, `agentTokenFile.ts`, `agentTokenAdmin.ts`
- `tat1.<id>.<secret>`: 64-bit public id, 256-bit secret. The token file (`TOLARIA_SERVER_TOKENS_FILE`, default `<data dir>/tokens.json`, mode `0600`, local disk only, refused inside the vault clone) keeps only SHA-256 of the secret, compared with `timingSafeEqual`
- Grants are `viewer` or `editor`, on the vault or on single notes; never `owner`
- **What a leaked token gives:** exactly its grants, until it expires or is revoked: reading what its scope covers (REST, MCP, change feed, websocket) and, for `editor`, committing changes there, which are pushed to the vault's git remote and name the token as co-author. It cannot reach other notes, revoke anything, or learn the owner token. Its requests count against its own rate-limit bucket
- **Revoking:** `pnpm run server:token revoke <name or id>` on the box (`docker exec … apps/server/scripts/token.ts revoke …` in the image). The server re-reads the file within about a second, refuses the token from then on and closes its open websockets and change feeds. A leaked editor token's commits stay in git history: review them with `git log --grep "tokens.tolaria.invalid"` (or the author you gave it) and revert what is unwanted
- **What a leaked token file gives:** the names, grants and hashes; not usable credentials, since a 256-bit secret cannot be recovered from its hash. Write access to the file is equivalent to minting tokens, so it must stay owned by the server's user
- Secrets and hashes are never logged, in error messages, or in `list` output; the id is public and may appear in logs and commit trailers
- There is no management API: an attacker with only network access cannot create or widen tokens

**Collaboration tickets:**
- 32 bytes of random data (base64url encoded) = 256 bits of entropy
- Single-use: consumed on first WebSocket connection
- Expire in 60 seconds
- Bound to specific `docId`
- Grant either `read` or `write` access
- Validated before WebSocket upgrade
- Cannot be reused or replayed

**Risk assessment:** **LOW**
- Strong cryptographic primitives
- Proper single-use and expiration semantics
- No timing attacks on token comparison

**Recommendations:**
- Consider adding ticket usage logging for security monitoring

### 3. WebSocket Authentication and Message Validation

**Implementation:** `apps/server/src/collab/upgrade.ts`, `apps/server/src/collab/hub.ts`, `apps/server/src/collab/room.ts`

**Authentication:**
- WebSocket upgrade requires bearer token OR valid ticket
- Ticket checked before upgrade via `admit()` function
- Read-only tickets enforced at message processing level
- Unauthenticated connections rejected with HTTP 401

**Message validation:**
- Max message size enforced at WebSocket layer (`maxPayload` set to min of config and protocol constant)
- Messages arriving before document opens are buffered up to one message worth of data
- Exceeding buffer closes connection with code 1009 (MESSAGE_TOO_BIG)
- Y.js updates validated and can be rejected (connection closed with code 4001)
- Read-only peers' updates are rejected
- Invalid messages close connection with code 4002
- Document integrity checks via `codec.violation()` before accepting updates

**Risk assessment:** **MEDIUM**
- Good authentication and size limits
- Document validation protects integrity
- **Since TOL-208 (ADR 0292):** at most 128 open websockets per account and 32 per document, refused at the upgrade with `429`; upgrades are charged to the account's request bucket; a socket that answers no ping for 60 s is closed with `4408`; the message limit is configurable (`TOLARIA_COLLAB_MAX_MESSAGE_BYTES`)
- **Missing:** Per-client rate limiting on message frequency

**Recommendations:**
1. Add per-client message rate limiting (e.g., 100 messages/second)
2. ~~Add per-vault connection limits~~ Done in TOL-208
3. ~~Add connection duration limits or idle timeouts~~ Idle timeout done in TOL-208

### 4. Security Headers and CSP

**Implementation:** `apps/server/src/httpIo.ts`

**Headers set by server:**
- ✅ `Cache-Control: no-store` - prevents caching of sensitive vault data
- ✅ `X-Content-Type-Options: nosniff` - prevents MIME sniffing
- ✅ Protocol version header for client compatibility

**Missing headers:**
- ❌ `X-Frame-Options` or `Content-Security-Policy: frame-ancestors`
- ❌ `Strict-Transport-Security` (but acceptable since server is behind TLS proxy)
- ❌ `Content-Security-Policy` for HTML responses (but server only serves JSON/markdown/binary)

**Desktop app CSP:**
The desktop Tauri app has extensive CSP configured in `src-tauri/tauri.conf.json` with proper nonce-based inline script/style controls. This is not relevant to the web server review.

**Risk assessment:** **LOW**
- Server doesn't serve HTML (only JSON/markdown/binary)
- Behind Cloudflare Worker which can add headers
- Cache controls properly prevent leakage

**Recommendations:**
1. Add `X-Frame-Options: DENY` as defense in depth
2. Document that HSTS is handled by Cloudflare Worker (out of scope)

### 5. Rate Limiting and Resource Exhaustion

**Implementation:** `apps/server/src/config.ts`, `apps/server/src/httpIo.ts`, `apps/server/src/server.ts`

**Protections in place:**
- ✅ Max body size enforced (default 25MB, configurable via `TOLARIA_SERVER_MAX_BODY_BYTES`)
- ✅ Body size checked before reading and during streaming
- ✅ WebSocket max payload enforced
- ✅ Collaboration messages buffered during document open with size limit
- ✅ Idle documents closed after linger period (default 30s)
- ✅ Git operations are serialized per vault (mutex via `queue`)
- ✅ Y.Doc updates validated before acceptance

- ✅ Per-account token bucket on every `/v1` request and websocket upgrade, refused upgrades included (TOL-231): 50 requests/s, bursts of 500, `429 rate_limited` with `Retry-After`; callers without the token share their own bucket (TOL-208, ADR 0292)
- ✅ At most 128 open websockets per account and 32 per document; idle sockets closed with `4408` (TOL-208)

**Missing protections:**
- ❌ No per-IP rate limiting in the container (left to the Cloudflare edge)
- ❌ No protection against slowloris-style attacks
- ❌ No limits on git repository size growth
- ❌ No limits on number of open documents per vault
- ❌ No request timeout enforcement at HTTP level

**Risk assessment:** **MEDIUM** (MEDIUM-HIGH before TOL-208)
- A single authenticated client can still use its whole request budget on expensive routes
- Can send maximum-sized bodies repeatedly
- Can trigger expensive git operations (sync, search) repeatedly
- **Note:** Cloudflare Worker (out of scope) likely provides some protection

**Recommendations:**
1. Add per-token request rate limiting (e.g., 100 req/min for file API)
2. Add per-vault concurrent WebSocket connection limit (e.g., 50)
3. Add per-vault concurrent HTTP request limit (e.g., 10)
4. Add request timeout at HTTP server level (e.g., 30s)
5. Add memory/CPU usage monitoring with alerts
6. Consider adding git repository size limits
7. Document that front-line rate limiting is handled by Cloudflare Worker

### 6. Server-Side Request Forgery (SSRF)

**Implementation:** `apps/server/src/store.ts`, `apps/server/src/config.ts`

**R2BlobStore SSRF risk:**

The `R2BlobStore` class makes HTTP requests to an S3-compatible endpoint for blob storage:

```typescript
async get(key: string): Promise<Uint8Array | null> {
  const url = this.objectUrl(key)  // Line 90
  const headers = this.signRequest('GET', url, '')
  const response = await fetch(url, { method: 'GET', headers })  // Line 93
  // ... similar for PUT (line 106), DELETE (line 121), LIST (line 135)
}
```

**Current protections:**
- ✅ Endpoint URL validated at config load time (must be HTTP or HTTPS)
- ✅ Endpoint host checked at startup (TOL-207, `apps/server/src/storeEndpoint.ts`): an IP literal, or every address the name resolves to, must be public per `isPublicAddress` (`apps/server/src/publicAddress.ts`, shared with the remote image import). Loopback, RFC 1918, CGNAT, link-local/metadata, ULA and IPv4-mapped addresses are refused, and the server does not start. `TOLARIA_R2_ALLOW_PRIVATE_ENDPOINT=1` lifts this for a local MinIO and is itself refused unless `NODE_ENV=development`
- ✅ Every store connection is checked too (TOL-207): `R2BlobStore` sends its requests with the shared `guardedLookup`, which resolves the host, refuses it when any address fails the policy and pins the socket to the checked address, so a later DNS answer cannot rebind the endpoint to an internal host
- ✅ Endpoint is operator configuration, not user input
- ✅ Keys are validated with the `SAFE_KEY` alphabet before use, for `R2BlobStore` as well as `LocalDiskStore` since TOL-207, so a key cannot leave the bucket path
- ✅ Credentials never logged or exposed

**Identified issue:**
The approved SSRF finding from Codacy (commit `fd8300eb`, decision by Karn 2026-10-23) notes:
- Lines 93, 106, 121, 135 in `apps/server/src/store.ts`
- Rule: `codacy.tools-configs.rules_lgpl_javascript_ssrf_rule-node-ssrf`
- Approval reason: "endpoint is validated operator config, not user input"
- Approval SHA: `b21837f65bb5b4d00f3743634b460d91e60fe5d208ad7552c95ce667e272ad35`
- Approval expires: 2026-10-30

**Risk assessment:** **LOW** (was LOW-MEDIUM before the TOL-207 startup check)
- Endpoint is operator-controlled configuration
- No user input directly influences the URL
- Keys are validated before incorporation into URL
- No explicit domain allowlist; private, loopback and metadata addresses are refused at startup (TOL-207)
- **Risk:** Misconfigured endpoint could point to internal services
- **Risk:** Container compromise could modify environment variables

**Code-level alternative to eliminate the finding:**

Instead of trusting the raw endpoint configuration, validate it against an explicit allowlist of allowed domains/IP ranges at configuration load time:

```typescript
// In config.ts, add validation:
function validateR2Endpoint(endpoint: string): void {
  const endpointUrl = new URL(endpoint)
  
  // Explicitly allowlist expected R2/S3 endpoints
  const allowedPatterns = [
    /^.+\.r2\.cloudflarestorage\.com$/,
    /^.+\.r2\.storage\.cloudflare\.com$/,
    /^s3\.amazonaws\.com$/,
    /^s3\..+\.amazonaws\.com$/,
    // Add operator's specific S3-compatible endpoint patterns
  ]
  
  const isAllowed = allowedPatterns.some(pattern => pattern.test(endpointUrl.hostname))
  if (!isAllowed) {
    throw new Error(
      `TOLARIA_R2_ENDPOINT domain '${endpointUrl.hostname}' is not in the allowlist. ` +
      `Configure allowed domains in config.ts validateR2Endpoint().`
    )
  }
  
  // Prevent internal IP ranges
  const ip = isIP(endpointUrl.hostname)
  if (ip) {
    const parts = endpointUrl.hostname.split('.')
    if (ip === 4) {
      // Block RFC1918 private ranges and loopback
      if (parts[0] === '10' || 
          (parts[0] === '172' && parseInt(parts[1]) >= 16 && parseInt(parts[1]) <= 31) ||
          (parts[0] === '192' && parts[1] === '168') ||
          parts[0] === '127') {
        throw new Error(`TOLARIA_R2_ENDPOINT cannot point to private IP range: ${endpointUrl.hostname}`)
      }
    }
    // Block link-local, etc.
    if (ip === 6 && (endpointUrl.hostname.startsWith('fe80:') || endpointUrl.hostname === '::1')) {
      throw new Error(`TOLARIA_R2_ENDPOINT cannot point to private IPv6 range: ${endpointUrl.hostname}`)
    }
  }
}
```

This would make the Codacy finding disappear because the endpoint would be constrained to an explicit allowlist, removing the SSRF risk entirely. However, this introduces operational overhead (allowlist maintenance) and may break legitimate use cases (self-hosted MinIO, etc.).

**Recommendations:**
1. **Option A (Least impact):** Keep current approved-report entry; document in threat model that R2 endpoint is operator-trusted configuration
2. **Option B (Defense in depth, small change):** Add private IP range validation at config load (prevents accidental internal endpoint configuration) — **done in TOL-207**
3. **Option C (Eliminates finding, operational overhead):** Implement full allowlist validation as shown above

**Remote image import (TOL-204):**

`POST /v1/attachments/imports` (`apps/server/src/remoteImage.ts`) fetches a client-supplied URL, so it is guarded in code rather than by configuration:

- ✅ Scheme allowlist (`http`, `https`); credentials in the URL are refused
- ✅ IP literals are checked before connecting; host names are resolved by a lookup that refuses the host when any resolved address is not public, and the socket connects to the checked address (no DNS rebinding window)
- ✅ Private, loopback, shared, link-local/metadata, documentation, multicast and reserved IPv4; IPv6 outside global unicast (loopback, ULA incl. `fd00:ec2::254`, link-local, IPv4-mapped) and the Teredo, 6to4 and documentation ranges are refused
- ✅ Each redirect re-checked (max 5); 15 MB and 15 s caps; only raster image content types; the bearer token is required
- ✅ Negative tests: `apps/server/test/remoteImage.test.ts`, `apps/server/test/attachments.test.ts`, `apps/web/tests/remote-attachments.spec.ts`

Residual risk: **LOW**. The server can still be made to send GET requests to arbitrary public hosts on behalf of an authenticated user.

### 7. Git Security

**Implementation:** `apps/server/src/gitRepo.ts`, `apps/server/src/git.ts`

**Protections in place:**
- ✅ Git clone configured with `core.symlinks=false` to prevent symlink attacks
- ✅ Git clone configured with `core.autocrlf=false` to prevent CRLF injection
- ✅ Uses `--` separator in git commands to prevent option injection
- ✅ All paths validated before git operations
- ✅ Remote URL is operator configuration
- ✅ Git operations serialized per vault (prevents race conditions)

**Risk assessment:** **LOW**
- Comprehensive git security configuration
- No user-controlled git options or URLs

**Recommendations:**
- None; implementation is sound

### 8. Input Validation

**Implementation:** Throughout `apps/server/src/routes.ts` and related modules

**Validations in place:**
- ✅ All paths validated via `vaultPath()`
- ✅ JSON body parsing with error handling
- ✅ Optional string fields validated
- ✅ Etags validated and parsed safely
- ✅ Search query length limited (200 chars max)
- ✅ Search result limit enforced (max 200)
- ✅ DocId validation via doc index lookup
- ✅ Access level validation (`read` or `write` only)

**Risk assessment:** **LOW**
- Consistent validation across API surface
- Type-safe interfaces prevent many classes of bugs

**Recommendations:**
- None; implementation is sound

## Cross-Boundary Issues for tolaria-cloud

These security concerns span the boundary between the open-source server (this repo) and the private Worker (tolaria-cloud repo):

1. **Bearer token distribution**: Worker must securely provision and rotate tokens for each container
2. **Rate limiting**: Worker should enforce per-user and per-vault rate limits before reaching container
3. **Request timeouts**: Worker should enforce request timeouts
4. **Connection limits**: Worker should enforce per-vault WebSocket connection limits
5. **HSTS and security headers**: Worker should add `Strict-Transport-Security` and other TLS-specific headers
6. **Authentication**: Worker validates Cloudflare Access auth before routing to container
7. **Vault isolation**: Worker ensures requests are routed only to authorized vaults

## Summary of Risk Levels

| Area | Risk Level | Status |
|------|-----------|--------|
| Path Traversal | LOW | ✅ Comprehensive validation |
| Token/Ticket Security | LOW | ✅ Strong cryptographic design |
| WebSocket Auth | LOW-MEDIUM | ✅ Connection limits and idle timeout (TOL-208); ⚠️ no message-rate limit |
| Security Headers | LOW | ✅ Adequate for JSON API |
| Rate Limiting | MEDIUM | ✅ Per-account request limit (TOL-208); ⚠️ no per-IP or concurrency limit in the container |
| SSRF (R2BlobStore) | LOW-MEDIUM | ⚠️ Operator config, approved exception |
| SSRF (remote image import) | LOW | ✅ Public-address guard, pinned connection, caps |
| Git Security | LOW | ✅ Proper hardening |
| Input Validation | LOW | ✅ Consistent validation |

## Recommendations Summary

**High priority:**
1. ~~Add per-token request rate limiting for file API~~ Done in TOL-208
2. ~~Add per-vault concurrent WebSocket connection limits~~ Done in TOL-208
3. Add per-client WebSocket message rate limiting

**Medium priority:**
4. Add request timeout enforcement
5. Add R2 endpoint validation against private IP ranges (Option B)
6. Add ticket usage logging
7. Add `X-Frame-Options: DENY` header

**Low priority / Out of scope:**
8. Document Worker responsibilities for rate limiting, HSTS, etc.
9. Consider connection duration limits or idle timeouts
10. Consider git repository size limits

## Revision History

- 2026-10-23: Initial threat model created (TOL-200 Part A review)
- 2026-10-24: Remote image import guard added to the SSRF section (TOL-204)
- 2026-11-17: Agent tokens added to Ticket and Token Security
