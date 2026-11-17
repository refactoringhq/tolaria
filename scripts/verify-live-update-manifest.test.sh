#!/usr/bin/env bash
# Regression guard for TOL-304: after a stable release the live
# tolaria.md/stable/latest.json kept serving the previous version. The
# post-deploy check must wait for the new version and fail if it never shows.
set -euo pipefail

cd "$(dirname "$0")/.."
verify=scripts/verify-live-update-manifest.sh
failures=0
work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT

pass() { echo "ok - $1"; }
fail() { echo "not ok - $1" >&2; failures=$((failures + 1)); }

# Fake curl: serves responses/<n>.json for the n-th request (repeating the
# last one), fails the request for responses/<n>.fail, and logs each URL.
mkdir -p "$work/bin"
cat > "$work/bin/curl" <<'FAKE'
#!/usr/bin/env bash
url="${*: -1}"
echo "$url" >> "$FAKE_CURL_DIR/requests.log"
count=$(wc -l < "$FAKE_CURL_DIR/requests.log")
response="$FAKE_CURL_DIR/responses/$count"
[[ -e "$response.json" || -e "$response.fail" ]] || response="$FAKE_CURL_DIR/responses/last"
[[ -e "$response.fail" ]] && exit 22
cat "$response.json"
FAKE
chmod +x "$work/bin/curl"

echo '{"version":"2026.11.17","platforms":{}}' > "$work/expected.json"

stage() {
  local dir="$work/$1"
  mkdir -p "$dir/responses"
  : > "$dir/requests.log"
  echo "$dir"
}

run_verify() {
  local dir=$1 expected=$2
  PATH="$work/bin:$PATH" FAKE_CURL_DIR="$dir" LIVE_MANIFEST_ATTEMPTS=3 LIVE_MANIFEST_INTERVAL=0 \
    bash "$verify" https://tolaria.md/stable/latest.json "$expected" run-42
}

expect_ok() {
  local output
  if output=$(run_verify "$2" "$work/expected.json" 2>&1); then pass "$1"; else fail "$1 (got: $output)"; fi
}

expect_failure() {
  local output
  if output=$(run_verify "$2" "${4:-$work/expected.json}" 2>&1); then
    fail "$1 (verifier passed)"
  elif [[ "$output" == *"$3"* ]]; then
    pass "$1"
  else
    fail "$1 (expected '$3', got: $output)"
  fi
}

dir=$(stage live)
echo '{"version":"2026.11.17"}' > "$dir/responses/last.json"
expect_ok "passes when the live manifest already has the released version" "$dir"
if grep -qx 'https://tolaria.md/stable/latest.json?cb=run-42-1' "$dir/requests.log"; then
  pass "busts the CDN cache with the run id"
else
  fail "busts the CDN cache with the run id (requests: $(cat "$dir/requests.log"))"
fi

dir=$(stage catches-up)
echo '{"version":"2026.10.30"}' > "$dir/responses/1.json"
touch "$dir/responses/2.fail"
echo '{"version":"2026.11.17"}' > "$dir/responses/last.json"
expect_ok "keeps polling through stale and failed responses until the new version is live" "$dir"

dir=$(stage stale)
echo '{"version":"2026.10.30"}' > "$dir/responses/last.json"
expect_failure "fails when the live manifest stays on the previous version (TOL-304)" "$dir" \
  "still serves 2026.10.30, expected 2026.11.17"
if [[ $(wc -l < "$dir/requests.log") -eq 3 ]]; then pass "gives up after the configured attempts"; else fail "gives up after the configured attempts"; fi

dir=$(stage garbage)
echo 'not json' > "$dir/responses/last.json"
expect_failure "fails when the live manifest is not valid JSON" "$dir" "expected 2026.11.17"

dir=$(stage no-expected)
echo '{}' > "$work/empty.json"
expect_failure "fails when the release manifest has no version" "$dir" "has no version" "$work/empty.json"

if (( failures > 0 )); then
  echo "$failures live manifest check(s) failed" >&2
  exit 1
fi
echo "All live manifest checks passed"
