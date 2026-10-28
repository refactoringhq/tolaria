#!/usr/bin/env bash
# Single entry point for every GitHub Pages publisher (deploy-docs.yml,
# release.yml, CircleCI publish-docs). It builds the tolaria.md landing and
# the VitePress docs, lays the landing over the docs root, then lets
# assemble-pages-site.sh write the updater manifests (latest.json,
# latest-canary.json, alpha/, stable/) and the download/release pages LAST so
# nothing from the landing or docs can shadow them. Finally it verifies the
# assembled site. Never deploy Pages without going through this script.
set -euo pipefail

usage() {
  echo "Usage: $0 <site-output-dir> [alpha-tag]" >&2
  exit 2
}

[[ $# -ge 1 && $# -le 2 ]] || usage

site_dir=${1%/}
alpha_tag=${2:-}
docs_dist="site/.vitepress/dist"
landing_dist="site/landing/dist"

if [[ "${PAGES_SKIP_BUILD:-}" != "1" ]]; then
  pnpm --filter @tolaria/landing build:tolaria-md
  VITEPRESS_BASE="${VITEPRESS_BASE:-/}" pnpm docs:build
fi

[[ -f "$landing_dist/index.html" ]] || { echo "Landing build missing: $landing_dist/index.html" >&2; exit 1; }
[[ -d "$docs_dist" ]] || { echo "Docs build missing: $docs_dist" >&2; exit 1; }

mkdir -p "$site_dir"
if [[ "$(cd "$site_dir" && pwd -P)" != "$(cd "$docs_dist" && pwd -P)" ]]; then
  cp -R "$docs_dist/." "$site_dir/"
fi
cp -R "$landing_dist/." "$site_dir/"

bash scripts/assemble-pages-site.sh "$site_dir" ${alpha_tag:+"$alpha_tag"}

bash scripts/verify-pages-site.sh "$site_dir" "$landing_dist/index.html"
