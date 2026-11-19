---
type: ADR
id: "0305"
title: "The server's container image runs bundles built at image build time, with only jsdom shipped as a package"
status: active
date: 2026-11-17
---

## Context

`apps/server` is a directory of the root package, not a workspace package, so its image ran `pnpm install` for the whole monorepo and copied all of `node_modules` (1.5 GB of React Native, Expo, mermaid, two TypeScripts and the rest), `src/`, `packages/` and `apps/server` into the runtime stage: 1.87 GB. At every start, `scripts/run.ts` bundled the entry point with esbuild, every package left external, because the markdown pipeline the collaboration channel shares with the app is written for a bundler. ADR 0304's token command ran unbundled under `node --experimental-strip-types` in the same image.

## Decision

- The build stage installs as before, then runs `apps/server/scripts/build-image.ts`, which bundles `src/main.ts` and `scripts/token.ts` with esbuild into `dist/main.mjs` and `dist/token.mjs`. `scripts/bundle.ts` holds the esbuild settings for both this and the dev runner (`run.ts`); the two differ only in what stays outside the bundle.
- Every package is bundled except `jsdom`. It reads `browser/default-stylesheet.css` relative to `__dirname` and calls `require.resolve('./xhr-sync-worker.js')` while its modules load, so a bundled copy fails at start-up. It is shipped as a package: the lockfile closure of `node_modules/.pnpm` entries reachable from it (44 entries, about 20 MB), copied with their symlinks, so its dependencies are exactly the installed versions.
- Yjs is bundled once; the image build fails if a bundle contains more than one Yjs build.
- Source maps are linked without `sourcesContent`, and the server runs as `node --enable-source-maps dist/main.mjs`: stack traces name the original files and lines, and the sources are not in the image.
- The token command is `tolaria-token` on the image's `PATH`, a launcher for `dist/token.mjs`. This supersedes ADR 0304's statement that the command runs under `node --experimental-strip-types` in the container; outside the container it is still `pnpm run server:token`.

## Options considered

- **Make `apps/server` a workspace package and `pnpm deploy` it.** The standard way to a production `node_modules`, but it changes the lockfile and the package layout of the repository, and the shared code in `src/` would still need a bundler. Not needed for the size this reaches.
- **Bundle `jsdom` too, with its asset files copied beside the bundle.** Smaller still, but it depends on how jsdom locates its files, which can change in any release without notice. Rejected.
- **Keep bundling at start, with a pruned `node_modules`.** Saves no work at start and still needs esbuild and every external package in the image. Rejected.

## Consequences

- The image is about 376 MB (arm64), of which about 250 MB is the Node base image, about 100 MB git with the SSH client and CA certificates, 6 MB the bundles and source maps, and 19 MB jsdom with its dependencies.
- The server no longer bundles itself at start, and the code in the image is owned by root and read-only to the server's user.
- The index snapshot fingerprint (`codeFingerprint` in `main.ts`) is the digest of `dist/main.mjs`, so snapshots from the old image are not reused by the new one.
- A new package that cannot be bundled has to be added to `SHIPPED_PACKAGES` in `scripts/bundle.ts`; `apps/server/test/imageBundle.test.ts` fails when the server bundle imports any package not on that list.
