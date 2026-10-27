#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
temp_dir="$(mktemp -d)"
trap 'rm -rf "$temp_dir"' EXIT
mkdir -p "$temp_dir/counts"

cat >"$temp_dir/chunk" <<'STUB'
#!/usr/bin/env bash
set -euo pipefail

if [[ "$1" != sidecar || "$2" != exec ]]; then
  exit 0
fi

args="${*: -1}"
if [[ "$args" == *"nohup setsid"* ]]; then
  exit 0
fi
if [[ "$args" == *"tail -180"* ]]; then
  exit 0
fi
if [[ "$args" == *"if [ -f"* ]]; then
  sidecar=""
  while [[ $# -gt 0 ]]; do
    if [[ "$1" == --sidecar-id ]]; then
      sidecar="$2"
      shift 2
    else
      shift
    fi
  done
  count_file="${POLL_COUNTS}/${sidecar}"
  count=0
  [[ -f "$count_file" ]] && count="$(cat "$count_file")"
  count=$((count + 1))
  printf '%s' "$count" >"$count_file"

  if [[ "$count" == 1 ]]; then
    case "$sidecar" in
      frontend) printf '%s\n' 'A new version of chunk is available. Full changelog: https://github.com/CircleCI-Public/chunk-cli/releases/tag/v0.7.224' >&2 ;;
      rust) printf '%s\n' 'A new version of chunk is available. Full changelog: https://github.com/CircleCI-Public/chunk-cli/releases/tag/v0.7.224' ;;
      playwright) printf '%s\n' 'A new version of chunk is available. Full changelog: https://github.com/CircleCI-Public/chunk-cli/releases/tag/v0.7.224' ;;
    esac
    [[ "$sidecar" == playwright ]] || echo running
  else
    if [[ "$sidecar" == playwright && "$count" == 2 ]]; then
      printf '%s\n' 'A new version of chunk is available. Full changelog: https://github.com/CircleCI-Public/chunk-cli/releases/tag/v0.7.224' >&2
      exit 0
    fi
    echo 0
  fi
fi
STUB
chmod +x "$temp_dir/chunk"

output_file="$temp_dir/output"
if ! CHUNK_BIN="$temp_dir/chunk" \
  CIRCLECI_ORG_ID=test-org \
  SIDECAR_FRONTEND_ID=frontend \
  SIDECAR_RUST_ID=rust \
  SIDECAR_PLAYWRIGHT_ID=playwright \
  SIDECAR_GATE_POLL_INTERVAL=0 \
  SIDECAR_GATE_TIMEOUT=5 \
  POLL_COUNTS="$temp_dir/counts" \
  bash "$repo_root/.chunk/run-sidecar-gates-local.sh" true >"$output_file" 2>&1; then
  cat "$output_file"
  exit 1
fi

if ! rg -q 'frontend passed' "$output_file" || ! rg -q 'rust passed' "$output_file" || ! rg -q 'playwright passed' "$output_file"; then
  cat "$output_file"
  echo "Expected every sidecar lane to pass despite Chunk update notices" >&2
  exit 1
fi

if rg -q 'failed with status|status poll failed|timed out' "$output_file"; then
  cat "$output_file"
  echo "Update notice was treated as a sidecar failure" >&2
  exit 1
fi

echo "sidecar status polling ignores Chunk update notices and waits through unknown results"
