#!/usr/bin/env bash
# Regression guard for the tolaria.md 404 (Release Alpha republished Pages
# without the landing). Checks the site verifier and that every Pages
# publisher goes through scripts/build-pages-site.sh.
set -euo pipefail

cd "$(dirname "$0")/.."
verify=scripts/verify-pages-site.sh
failures=0
work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT

pass() { echo "ok - $1"; }
fail() { echo "not ok - $1" >&2; failures=$((failures + 1)); }

landing='<!doctype html><title>Tolaria: a second brain for the AI era</title><div id="root"></div>'
printf '%s\n' "$landing" > "$work/landing-index.html"

make_site() {
  local dir="$work/$1"
  mkdir -p "$dir/docs" "$dir/download" "$dir/stable/download" "$dir/releases" "$dir/alpha"
  printf '%s\n' "$landing" > "$dir/index.html"
  for file in CNAME docs/index.html download/index.html stable/download/index.html releases/index.html \
    latest.json latest-canary.json alpha/latest.json stable/latest.json; do
    echo '{}' > "$dir/$file"
  done
  echo "$dir"
}

expect_ok() {
  if bash "$verify" "$2" "$work/landing-index.html" > /dev/null 2>&1; then pass "$1"; else fail "$1"; fi
}

expect_failure() {
  local output
  if output=$(bash "$verify" "$2" "$work/landing-index.html" 2>&1); then
    fail "$1 (verifier passed)"
  elif [[ "$output" == *"$3"* ]]; then
    pass "$1"
  else
    fail "$1 (expected '$3', got: $output)"
  fi
}

expect_ok "accepts landing at root plus docs, release pages and updater manifests" "$(make_site good)"

site=$(make_site no-root); rm "$site/index.html"
expect_failure "fails when root index.html is missing (the tolaria.md 404)" "$site" "missing index.html"

site=$(make_site vitepress-root)
printf '<title>404 | Tolaria</title><script>window.__VP_HASH_MAP__={}</script>\n' > "$site/index.html"
expect_failure "fails when root is the VitePress 404" "$site" "root index.html is a 404 page"
expect_failure "fails when root is a VitePress page" "$site" "VitePress page, not the landing"

site=$(make_site other-root); echo '<title>Something else</title>' > "$site/index.html"
expect_failure "fails when root differs from the landing build" "$site" "not the landing build"

for file in latest.json latest-canary.json alpha/latest.json stable/latest.json CNAME docs/index.html; do
  site=$(make_site "missing-${file//\//-}"); rm "$site/$file"
  expect_failure "fails when $file is missing" "$site" "missing $file"
done

publishers=(.circleci/config.yml)
while IFS= read -r workflow; do
  publishers+=("$workflow")
done < <(grep -lE 'actions/(deploy-pages|upload-pages-artifact)@' .github/workflows/*.yml .github/workflows/*.yaml 2>/dev/null || true)

for expected in .github/workflows/deploy-docs.yml .github/workflows/release.yml; do
  if [[ " ${publishers[*]} " == *" $expected "* ]]; then pass "$expected is a known Pages publisher"; else fail "$expected is a known Pages publisher"; fi
done

for publisher in "${publishers[@]}"; do
  if grep -q 'bash scripts/build-pages-site.sh ' "$publisher" \
    && ! grep -qE 'assemble-pages-site\.sh[[:space:]]' "$publisher" \
    && ! grep -qE 'bun scripts/build-release-(download|history)-page' "$publisher"; then
    pass "$publisher publishes Pages only through scripts/build-pages-site.sh"
  else
    fail "$publisher must build Pages with scripts/build-pages-site.sh (not assemble-pages-site.sh or its own steps)"
  fi
done

if (( failures > 0 )); then
  echo "$failures Pages site check(s) failed" >&2
  exit 1
fi
echo "All Pages site checks passed"
