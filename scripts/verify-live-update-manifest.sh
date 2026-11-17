#!/usr/bin/env bash
# Polls a live updater manifest (e.g. https://tolaria.md/stable/latest.json)
# until it matches the manifest the release published (same JSON, key order
# aside), and fails otherwise. A Pages deployment can report success while
# the previous one stays live (TOL-304), so a release is not done until users
# can see it. Comparing the whole manifest also catches a re-run release that
# kept its version but got new signatures.
set -euo pipefail

usage() {
  echo "Usage: $0 <manifest-url> <expected-manifest-file> <cache-buster>" >&2
  exit 2
}

[[ $# -eq 3 ]] || usage

manifest_url=$1
expected_file=$2
cache_buster=$3
attempts=${LIVE_MANIFEST_ATTEMPTS:-30}
interval=${LIVE_MANIFEST_INTERVAL:-15}

expected_version=$(jq -r '.version // empty' "$expected_file")
if [[ -z "$expected_version" ]]; then
  echo "::error::$expected_file has no version to compare against" >&2
  exit 1
fi
expected_manifest=$(jq -cS . "$expected_file")

live_manifest() {
  curl -fsSL --max-time 10 "${manifest_url}?cb=${cache_buster}-$1" 2>/dev/null \
    | jq -cS . 2>/dev/null || true
}

describe_mismatch() {
  local version
  version=$(jq -r '.version // empty' <<< "$1" 2>/dev/null || true)
  if [[ "$version" == "$expected_version" ]]; then
    echo "serves $version but does not match the released manifest"
  else
    echo "still serves ${version:-nothing}, expected $expected_version"
  fi
}

live=""
for ((attempt = 1; attempt <= attempts; attempt++)); do
  live=$(live_manifest "$attempt")
  if [[ "$live" == "$expected_manifest" ]]; then
    echo "$manifest_url serves the released $expected_version manifest"
    exit 0
  fi
  echo "Attempt $attempt/$attempts: $manifest_url $(describe_mismatch "$live")"
  if ((attempt < attempts)); then
    sleep "$interval"
  fi
done

echo "::error::$manifest_url $(describe_mismatch "$live")" >&2
exit 1
