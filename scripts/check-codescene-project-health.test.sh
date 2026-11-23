#!/usr/bin/env bash
# Regression guard for TOL-442: the CircleCI CodeScene project health gate
# failed main because the API answered once with an HTML page instead of JSON.
# The gate must retry such transient replies, yet still fail closed when the
# scores never arrive or are below the .codescene-thresholds floors.
set -euo pipefail

cd "$(dirname "$0")/.."
gate=scripts/check-codescene-project-health.sh
failures=0
work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT

pass() { echo "ok - $1"; }
fail() { echo "not ok - $1" >&2; failures=$((failures + 1)); }

# Fake curl: serves responses/<n>.json for the n-th request (repeating the
# last one), fails the request for responses/<n>.fail, and logs each request.
mkdir -p "$work/bin"
cat > "$work/bin/curl" <<'FAKE'
#!/usr/bin/env bash
echo "${*: -1}" >> "$FAKE_CURL_DIR/requests.log"
count=$(wc -l < "$FAKE_CURL_DIR/requests.log")
response="$FAKE_CURL_DIR/responses/$count"
[[ -e "$response.json" || -e "$response.fail" ]] || response="$FAKE_CURL_DIR/responses/last"
[[ -e "$response.fail" ]] && exit 22
cat "$response.json"
FAKE
chmod +x "$work/bin/curl"

printf 'HOTSPOT_THRESHOLD=10.0\nAVERAGE_THRESHOLD=9.98\n' > "$work/thresholds"
healthy='{"analysis":{"hotspot_code_health":{"now":10.0},"code_health":{"now":9.9829}}}'
degraded='{"analysis":{"hotspot_code_health":{"now":10.0},"code_health":{"now":9.97}}}'
html='<!DOCTYPE html><html><body>502 Bad Gateway</body></html>'

stage() {
  local dir="$work/$1"
  mkdir -p "$dir/responses"
  : > "$dir/requests.log"
  echo "$dir"
}

run_gate() {
  FAKE_CURL_DIR="$1" PATH="$work/bin:$PATH" \
    CODESCENE_PAT=test-token CODESCENE_PROJECT_ID=123 \
    CODESCENE_THRESHOLDS_FILE="$work/thresholds" \
    CODESCENE_GATE_ATTEMPTS=3 CODESCENE_GATE_RETRY_DELAY=0 \
    bash "$gate" > "$1/out.log" 2>&1
}

requests() { wc -l < "$1/requests.log" | tr -d ' '; }

dir=$(stage healthy)
echo "$healthy" > "$dir/responses/last.json"
if run_gate "$dir" && grep -q 'Average Code Health: 9.98 (threshold 9.98)' "$dir/out.log"; then
  pass "passes when both scores meet the floors"
else
  fail "passes when both scores meet the floors"
fi

dir=$(stage html-then-json)
echo "$html" > "$dir/responses/1.json"
touch "$dir/responses/2.fail"
echo "$healthy" > "$dir/responses/last.json"
if run_gate "$dir" && [[ "$(requests "$dir")" == 3 ]]; then
  pass "retries an HTML reply and a failed request, then passes"
else
  fail "retries an HTML reply and a failed request, then passes"
fi

dir=$(stage always-html)
echo "$html" > "$dir/responses/last.json"
if ! run_gate "$dir" && [[ "$(requests "$dir")" == 3 ]] \
  && grep -q 'no readable scores after 3 attempts' "$dir/out.log"; then
  pass "fails closed when the scores never arrive"
else
  fail "fails closed when the scores never arrive"
fi

for reply in null-score string-score; do
  dir=$(stage "$reply")
  if [[ "$reply" == null-score ]]; then
    echo '{"analysis":{"hotspot_code_health":{"now":null},"code_health":{"now":9.99}}}' > "$dir/responses/last.json"
  else
    echo '{"analysis":{"hotspot_code_health":{"now":"10.0"},"code_health":{"now":true}}}' > "$dir/responses/last.json"
  fi
  if ! run_gate "$dir" && [[ "$(requests "$dir")" == 3 ]] \
    && grep -q 'no readable scores after 3 attempts' "$dir/out.log"; then
    pass "retries and then fails closed on a $reply reply"
  else
    fail "retries and then fails closed on a $reply reply"
  fi
done

dir=$(stage degraded)
echo "$degraded" > "$dir/responses/last.json"
if ! run_gate "$dir" && [[ "$(requests "$dir")" == 1 ]] \
  && grep -q 'CodeScene project health gate failed' "$dir/out.log"; then
  pass "fails without retrying when a score is below its floor"
else
  fail "fails without retrying when a score is below its floor"
fi

dir=$(stage missing-credentials)
echo "$healthy" > "$dir/responses/last.json"
if ! FAKE_CURL_DIR="$dir" PATH="$work/bin:$PATH" CODESCENE_PAT='' CODESCENE_PROJECT_ID='' \
  bash "$gate" > "$dir/out.log" 2>&1 && [[ "$(requests "$dir")" == 0 ]]; then
  pass "fails when the CodeScene credentials are missing"
else
  fail "fails when the CodeScene credentials are missing"
fi

if (( failures > 0 )); then
  echo "$failures CodeScene project health check(s) failed" >&2
  exit 1
fi
echo "All CodeScene project health checks passed"
