# Tolaria CircleCI

`.circleci/config.yml` is the source of truth for validation, cross-platform release builds,
GitHub Release publication, documentation deployment, and pull-request branch maintenance.

## Workflows

- `validation` runs frontend lint/build/coverage, parallel Rust lint and coverage jobs, the curated
  Playwright smoke lane, CodeScene, Codacy, and Linux build verification.
- `alpha-release` runs on qualifying `main` pushes and publishes signed macOS ARM64/x86_64,
  Linux x86_64, and Windows x86_64 artifacts.
- `stable-release` runs for `v20*` and `stable-v*` tags and publishes the same platform set plus
  stable macOS DMGs.

The frontend and Playwright jobs reuse `.chunk/` lane scripts. The parallel Rust jobs run the same
lint, format, and coverage commands as `.chunk/run-rust-gate.sh`. Chunk sidecars remain the preferred
pre-push path; CircleCI is the authoritative outer loop.

## Contexts

Create three restricted CircleCI contexts.

### `tolaria-ci`

| Variable | Purpose |
| --- | --- |
| `CODESCENE_PAT` | Read the CodeScene project analysis. |
| `CODESCENE_PROJECT_ID` | Select the Tolaria CodeScene project. |

### `tolaria-release`

| Variable | Purpose |
| --- | --- |
| `TAURI_SIGNING_PRIVATE_KEY` | Sign Tauri updater artifacts. |
| `TAURI_KEY_PASSWORD` | Unlock the Tauri updater key. |
| `APPLE_CERTIFICATE` | Base64 Apple Developer certificate. |
| `APPLE_CERTIFICATE_PASSWORD` | Unlock the Apple certificate. |
| `APPLE_SIGNING_IDENTITY` | Select the Apple signing identity. |
| `APPLE_ID` | Authenticate Apple notarization. |
| `APPLE_PASSWORD` | App-specific Apple notarization password. |
| `APPLE_TEAM_ID` | Select the Apple developer team. |
| `VITE_SENTRY_DSN` | Configure frontend crash reporting in packaged builds. |
| `SENTRY_DSN` | Configure native crash reporting in packaged builds. |
| `VITE_POSTHOG_KEY` | Configure packaged-build analytics. |
| `VITE_POSTHOG_HOST` | Select the PostHog endpoint. |

### `tolaria-github`

| Variable | Purpose |
| --- | --- |
| `GH_TOKEN` | Publish releases and Pages, and update pull-request branches. |

Optional Windows Authenticode variables are
`WINDOWS_CODE_SIGNING_CERTIFICATE`, `WINDOWS_CODE_SIGNING_CERTIFICATE_PASSWORD`,
`WINDOWS_CODE_SIGNING_CERTIFICATE_THUMBPRINT`, and
`WINDOWS_CODE_SIGNING_TIMESTAMP_URL`. The legacy `WINDOWS_CERTIFICATE*` aliases remain supported.

`GH_TOKEN` should be a fine-grained token or GitHub App installation token restricted to
`refactoringhq/tolaria`. It needs repository contents and pull-request write access. Keeping it in
its own context prevents build jobs from receiving GitHub write access and prevents publication
jobs from receiving signing credentials.

## GitHub configuration

Install the CircleCI GitHub App for the repository and enable CircleCI Checks. Require these checks
for protected branches:

- `validation/frontend-quality`
- `validation/rust-coverage`
- `validation/rust-lint`
- `validation/playwright-smoke`

Configure GitHub Pages to publish from the root of the `gh-pages` branch. CircleCI builds the site,
commits generated output to that branch, and GitHub performs only its managed Pages deployment.

## Local validation

Install the CircleCI CLI and validate the expanded configuration:

```bash
circleci config validate .circleci/config.yml
circleci config process .circleci/config.yml
```

The normal repository gates remain mandatory:

```bash
pnpm lint
pnpm test:coverage
cargo llvm-cov --manifest-path src-tauri/Cargo.toml --no-clean --fail-under-lines 85
pnpm playwright:smoke
```
