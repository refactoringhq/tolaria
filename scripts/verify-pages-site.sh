#!/usr/bin/env bash
# Fails when an assembled GitHub Pages site would break tolaria.md: the root
# must be the landing page (not a VitePress page or a 404), and the docs,
# release pages and updater manifests must all be present.
# Usage: verify-pages-site.sh <site-dir> [landing-index.html]
set -euo pipefail

[[ $# -ge 1 && $# -le 2 ]] || { echo "Usage: $0 <site-dir> [landing-index.html]" >&2; exit 2; }

site_dir=${1%/}
landing_index=${2:-}
required_files=(
  index.html
  CNAME
  docs/index.html
  download/index.html
  stable/download/index.html
  releases/index.html
  latest.json
  latest-canary.json
  alpha/latest.json
  stable/latest.json
)

problems=()
for file in "${required_files[@]}"; do
  [[ -f "$site_dir/$file" ]] || problems+=("missing $file")
done

root_index="$site_dir/index.html"
if [[ -f "$root_index" ]]; then
  if grep -Eqi '<title>[[:space:]]*404' "$root_index"; then
    problems+=("root index.html is a 404 page")
  fi
  if grep -q '__VP_HASH_MAP__' "$root_index"; then
    problems+=("root index.html is a VitePress page, not the landing")
  fi
  if [[ -n "$landing_index" ]]; then
    if [[ ! -f "$landing_index" ]]; then
      problems+=("landing build missing: $landing_index")
    elif ! cmp -s "$landing_index" "$root_index"; then
      problems+=("root index.html is not the landing build")
    fi
  fi
fi

if (( ${#problems[@]} > 0 )); then
  for problem in "${problems[@]}"; do
    echo "Pages site check failed: $problem" >&2
  done
  exit 1
fi
echo "Pages site OK: $site_dir (landing at /, docs, release pages, updater manifests)"
