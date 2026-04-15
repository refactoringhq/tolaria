# CI/CD Setup

## GitHub Actions Workflow

Il workflow `ci.yml` esegue i seguenti check automatici:

### 1. Tests
- Frontend: `pnpm test`
- Rust backend: `cargo test`

### 2. Test Coverage
- Frontend: vitest con coverage reporting
- Threshold configurabile in `vitest.config.ts`

### 3. Code Health (CodeScene)
- Delta analysis su ogni PR/push
- Fail se il code health diminuisce
- Richiede secrets configurati (vedi sotto)

### 4. Documentation Check
- Verifica che se cambia codice in `src/` o `src-tauri/`, anche `docs/` viene aggiornato
- **Warning only** — non blocca il merge, solo un reminder
- Skip con `[skip docs]` nel commit message
- Aggiorna docs solo se la modifica invalida architettura/astrazioni/design già documentati

### 5. Lint & Format
- ESLint per frontend
- Clippy + rustfmt per Rust

## Setup Required

### CodeScene Secrets
Aggiungi questi secrets nel repository GitHub (Settings → Secrets → Actions):

```
CODESCENE_TOKEN=<your-codescene-pat>
CODESCENE_PROJECT_ID=<your-project-id>
```

Il PAT di CodeScene è lo stesso che usi localmente (~/.codescene/token).
Il project ID lo trovi nella dashboard CodeScene.

### Telemetry Secrets For Release Builds
Aggiungi anche questi secrets per i workflow `release.yml` e `release-stable.yml`:

```
VITE_SENTRY_DSN=<frontend sentry dsn>
SENTRY_DSN=<same dsn for rust/native crash reporting>
VITE_POSTHOG_KEY=<posthog project api key>
VITE_POSTHOG_HOST=https://eu.i.posthog.com
```

Senza questi valori, i build distribuiti possono mantenere i toggle telemetry nelle Settings ma non inizializzare davvero PostHog/Sentry.

### Coverage Thresholds
Configura in `vitest.config.ts`:

```typescript
export default defineConfig({
  test: {
    coverage: {
      lines: 80,
      functions: 80,
      branches: 80,
      statements: 80,
      // Fail CI se sotto threshold
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 80,
        statements: 80
      }
    }
  }
})
```

## Local Testing

Prima di pushare, puoi testare localmente:

```bash
# Run all tests
pnpm test && cargo test

# Check coverage
pnpm test:coverage

# Lint
pnpm lint
cargo clippy
cargo fmt --check

# CodeScene (local)
codescene delta-analysis --base-revision origin/main
```

## Workflow Triggers

- **Push**: su `main` e branch `experiment/*`
- **Pull Request**: verso `main`

## Status Checks

Tutti i check devono passare prima di poter fare merge.
Se un check fallisce, vedrai il dettaglio nei logs di GitHub Actions.
