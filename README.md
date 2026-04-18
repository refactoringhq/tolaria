[![CodeScene Hotspot Code Health](https://codescene.io/projects/76865/status-badges/hotspot-code-health)](https://codescene.io/projects/76865) [![CodeScene Average Code Health](https://codescene.io/projects/76865/status-badges/average-code-health)](https://codescene.io/projects/76865)
# Tolaria App

Personal knowledge and life management desktop app built with Tauri v2 + React + TypeScript + BlockNote.

## Documentation

- 📐 [ARCHITECTURE.md](docs/ARCHITECTURE.md) — System design, tech stack, data flow
- 🧩 [ABSTRACTIONS.md](docs/ABSTRACTIONS.md) — Core abstractions and models
- 🚀 [GETTING-STARTED.md](docs/GETTING-STARTED.md) — How to navigate the codebase
- 🎨 [THEMING.md](docs/THEMING.md) — Theme system and customization

## Quick Start

### Prerequisites

- Node.js 20+
- pnpm 8+
- Rust (latest stable)
- macOS (for development)

### Setup

```bash
# Install dependencies
pnpm install

# Run dev server
pnpm dev

# Open in browser (mock mode)
open http://localhost:5173

# Or run in Tauri
pnpm tauri dev
```

### Testing

```bash
# Frontend tests
pnpm test

# Backend tests
cargo test

# Coverage
pnpm test:coverage

# E2E tests
pnpm test:e2e
```

### Code Quality

```bash
# Lint
pnpm lint

# Rust checks
cargo clippy
cargo fmt --check

# CodeScene (via Claude Code)
claude 'Check code health with CodeScene MCP'
```

## Development Workflow

See [AGENTS.md](AGENTS.md) for coding guidelines and workflow. [CLAUDE.md](CLAUDE.md) remains as a compatibility shim for Claude Code.

**Key principles:**
- Small, atomic commits
- Test as you go
- Visual verification mandatory
- Documentation updated with code changes

## CI/CD

GitHub Actions runs on every push to `main`:
- ✅ Tests (frontend + Rust)
- 📊 Coverage (70% threshold)
- 🎨 Lint & format
- ⚠️ Documentation check

See [.github/SETUP.md](.github/SETUP.md) for CI/CD configuration.

## Git Hooks

Husky installs the git hooks from `.husky/` during `pnpm install`. The repo enforces `main`-only commits and pushes; see [.github/HOOKS.md](.github/HOOKS.md) for details.

## License

Tolaria is licensed under the GNU Affero General Public License, version 3 or any later version (AGPL-3.0-or-later).

See [LICENSE](LICENSE) for the full license text.

## Trademarks

The Tolaria name and logo are not licensed under the AGPL.

See [trademarks.md](trademarks.md) for the trademark policy.
