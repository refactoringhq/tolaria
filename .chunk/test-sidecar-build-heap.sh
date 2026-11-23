#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
tmp_dir="$(mktemp -d)"
trap 'rm -rf "$tmp_dir"' EXIT

cat > "$tmp_dir/pnpm" <<'MOCK_PNPM'
#!/usr/bin/env bash
set -euo pipefail
case "${1:-}" in
  install|lint|test:coverage) exit 0 ;;
  build) printf 'build NODE_OPTIONS=%s\n' "${NODE_OPTIONS:-}" ;;
  *) printf 'unexpected pnpm command: %s\n' "$*" >&2; exit 2 ;;
esac
MOCK_PNPM
chmod +x "$tmp_dir/pnpm"

output="$(PATH="$tmp_dir:$PATH" bash "$repo_root/.chunk/run-sidecar-lane.sh" frontend)"
if [[ "$output" != *'build NODE_OPTIONS=--max-old-space-size=4096'* ]]; then
  printf 'Frontend build did not receive the expected Node heap setting\n%s\n' "$output" >&2
  exit 1
fi
if [[ "$output" != *'frontend-coverage passed'* ]]; then
  printf 'Frontend coverage gate did not pass\n%s\n' "$output" >&2
  exit 1
fi
