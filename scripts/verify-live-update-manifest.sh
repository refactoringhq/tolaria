#!/usr/bin/env bash
# Polls a live updater manifest (e.g. https://tolaria.md/stable/latest.json)
# until its version matches the manifest the release published, and fails
# otherwise. A Pages deployment can report success while the previous one
# stays live (TOL-304), so a release is not done until users can see it.
set -euo pipefail

usage() {
  echo "Usage: $0 <manifest-url> <expected-manifest-file> <cache-buster>" >&2
  exit 2
}

[[ $# -eq 3 ]] || usage

manifest_url=$1
expected_file=$2
cache_buster=$3
attempts=${LIVE_MANIFEST_ATTEMPTS:-40}
interval=${LIVE_MANIFEST_INTERVAL:-15}

expected_version=$(jq -r '.version // empty' "$expected_file")
if [[ -z "$expected_version" ]]; then
  echo "::error::$expected_file has no version to compare against" >&2
  exit 1
fi

live_version() {
  curl -fsSL --max-time 20 "${manifest_url}?cb=${cache_buster}-$1" 2>/dev/null \
    | jq -r '.version // empty' 2>/dev/null || true
}

live=""
for ((attempt = 1; attempt <= attempts; attempt++)); do
  live=$(live_version "$attempt")
  if [[ "$live" == "$expected_version" ]]; then
    echo "$manifest_url serves $expected_version"
    exit 0
  fi
  echo "Attempt $attempt/$attempts: $manifest_url serves '${live:-nothing}', waiting for $expected_version"
  if ((attempt < attempts)); then
    sleep "$interval"
  fi
done

echo "::error::$manifest_url still serves ${live:-nothing}, expected $expected_version" >&2
exit 1
