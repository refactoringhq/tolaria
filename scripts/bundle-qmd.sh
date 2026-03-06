#!/usr/bin/env bash
# Bundle qmd into a self-contained directory for Tauri resource embedding.
#
# Output: src-tauri/resources/qmd/
#   qmd                                  — compiled standalone binary
#   node_modules/sqlite-vec/             — JS shim for sqlite-vec
#   node_modules/sqlite-vec-darwin-arm64/ — native .dylib (arm64)
#   node_modules/sqlite-vec-darwin-x64/  — native .dylib (x64)
#   node_modules/node-llama-cpp/         — stub (keyword search only)
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT="$SCRIPT_DIR/.."
OUT="$ROOT/src-tauri/resources/qmd"

# ---------- locate tools ----------
find_bun() {
  for c in \
    "$HOME/.bun/bin/bun" \
    "/opt/homebrew/bin/bun" \
    "/usr/local/bin/bun"; do
    [[ -x "$c" ]] && { echo "$c"; return 0; }
  done
  command -v bun 2>/dev/null && return 0
  return 1
}

BUN=$(find_bun) || { echo "ERROR: bun not found — install from https://bun.sh" >&2; exit 1; }
echo "Using bun: $BUN"

# ---------- locate qmd source ----------
# Prefer bundled source in tools/qmd/ (works in CI and dev),
# then fall back to globally installed qmd on dev machines.
QMD_SRC=""
for c in \
  "$ROOT/tools/qmd" \
  "$HOME/.bun/install/global/node_modules/qmd" \
  "/opt/homebrew/lib/node_modules/qmd" \
  "/usr/local/lib/node_modules/qmd"; do
  [[ -f "$c/src/qmd.ts" ]] && { QMD_SRC="$c"; break; }
done

[[ -n "$QMD_SRC" ]] || { echo "ERROR: qmd source not found. tools/qmd/ is missing or incomplete." >&2; exit 1; }
echo "Using qmd source: $QMD_SRC"

# Install qmd dependencies if needed (for CI where node_modules don't exist yet)
if [[ ! -d "$QMD_SRC/node_modules" ]]; then
  echo "Installing qmd dependencies..."
  (cd "$QMD_SRC" && "$BUN" install --frozen-lockfile)
fi

# ---------- compile ----------
echo "Compiling qmd with bun build --compile..."
mkdir -p "$OUT"

(cd "$QMD_SRC" && "$BUN" build --compile \
  "src/qmd.ts" \
  --outfile "$OUT/qmd" \
  --external node-llama-cpp \
  --external sqlite-vec \
  --external sqlite-vec-darwin-arm64 \
  --external sqlite-vec-darwin-x64)

chmod +x "$OUT/qmd"

# ---------- bundle sqlite-vec ----------
echo "Bundling sqlite-vec native extensions..."

# Find sqlite-vec packages — prefer node_modules in QMD_SRC (after bun install),
# fall back to bun global cache for dev machines.
NM="$QMD_SRC/node_modules"

find_pkg() {
  local pkg="$1"
  # Check node_modules from bun install in QMD_SRC first
  if [[ -d "$NM/$pkg" ]]; then
    echo "$NM/$pkg"; return 0
  fi
  # Fall back to bun global cache
  local cache_dir
  cache_dir=$(find "$HOME/.bun/install/cache" -maxdepth 1 -name "${pkg}@*" -type d 2>/dev/null | head -1)
  [[ -n "$cache_dir" ]] && echo "$cache_dir" && return 0
  return 1
}

# sqlite-vec JS shim
SQLVEC_DIR=$(find_pkg "sqlite-vec") || { echo "ERROR: sqlite-vec not found" >&2; exit 1; }
mkdir -p "$OUT/node_modules/sqlite-vec"
cp "$SQLVEC_DIR/index.mjs" "$OUT/node_modules/sqlite-vec/index.mjs"
cp "$SQLVEC_DIR/package.json" "$OUT/node_modules/sqlite-vec/package.json"
[[ -f "$SQLVEC_DIR/index.cjs" ]] && cp "$SQLVEC_DIR/index.cjs" "$OUT/node_modules/sqlite-vec/index.cjs"

# sqlite-vec-darwin-arm64
ARM64_DIR=$(find_pkg "sqlite-vec-darwin-arm64") || true
if [[ -n "$ARM64_DIR" ]]; then
  mkdir -p "$OUT/node_modules/sqlite-vec-darwin-arm64"
  cp "$ARM64_DIR/vec0.dylib" "$OUT/node_modules/sqlite-vec-darwin-arm64/vec0.dylib"
  cp "$ARM64_DIR/package.json" "$OUT/node_modules/sqlite-vec-darwin-arm64/package.json"
  echo "  ✓ arm64 dylib"
fi

# sqlite-vec-darwin-x64
X64_DIR=$(find_pkg "sqlite-vec-darwin-x64") || true
if [[ -n "$X64_DIR" ]]; then
  mkdir -p "$OUT/node_modules/sqlite-vec-darwin-x64"
  cp "$X64_DIR/vec0.dylib" "$OUT/node_modules/sqlite-vec-darwin-x64/vec0.dylib"
  cp "$X64_DIR/package.json" "$OUT/node_modules/sqlite-vec-darwin-x64/package.json"
  echo "  ✓ x64 dylib"
fi

# ---------- stub node-llama-cpp ----------
echo "Creating node-llama-cpp stub (keyword search only)..."
mkdir -p "$OUT/node_modules/node-llama-cpp"

cat > "$OUT/node_modules/node-llama-cpp/package.json" << 'PJSON'
{"name":"node-llama-cpp","version":"0.0.0-stub","type":"module","main":"index.js"}
PJSON

cat > "$OUT/node_modules/node-llama-cpp/index.js" << 'STUB'
// Stub: node-llama-cpp not bundled — semantic search unavailable, keyword search works.
const unavailable = (name) => (...args) => {
  throw new Error(`${name}() unavailable: node-llama-cpp not bundled. Keyword search still works.`);
};
export const getLlama = unavailable("getLlama");
export const resolveModelFile = unavailable("resolveModelFile");
export class LlamaChatSession {
  constructor() { throw new Error("LlamaChatSession unavailable"); }
}
export const LlamaLogLevel = { Error: 0, Warn: 1, Info: 2, Debug: 3 };
STUB

# ---------- ad-hoc code signing (macOS) ----------
if [[ "$(uname)" == "Darwin" ]] && command -v codesign &>/dev/null; then
  echo "Ad-hoc signing bundled binaries..."
  codesign --force --sign - "$OUT/qmd" 2>/dev/null && echo "  ✓ qmd signed" || echo "  ⚠ qmd signing failed (non-fatal)"
  find "$OUT/node_modules" -name "*.dylib" -exec sh -c 'codesign --force --sign - "$1" 2>/dev/null && echo "  ✓ $(basename "$1") signed"' _ {} \;
fi

# ---------- summary ----------
echo ""
echo "qmd bundled → $OUT/"
du -sh "$OUT/qmd"
du -sh "$OUT/node_modules"
echo "Done."
