import { spawnSync } from 'node:child_process'
import { error as logError, log } from 'node:console'
import { existsSync } from 'node:fs'
import {
  chmod,
  mkdir,
  mkdtemp,
  readFile,
  rename,
  rm,
  writeFile,
} from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { basename, dirname, join, resolve } from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

export const BROKEN_LINUXDEPLOY_APPRUN_DIR_LINE =
  'this_dir="$(readlink -f "$(dirname "$0")")"'
export const FIXED_LINUXDEPLOY_APPRUN_DIR_LINE =
  'this_dir="$(dirname "$(readlink -f "$0")")"'
export const APPIMAGE_PLUGIN_WRAPPER_NAME = 'linuxdeploy-plugin-appimage.AppImage'
export const REAL_APPIMAGE_PLUGIN_NAME =
  'tolaria-real-linuxdeploy-plugin-appimage/linuxdeploy-plugin-appimage.AppImage'
export const APPIMAGE_FCITX_GTK3_IM_MODULE_PATH =
  'usr/lib/x86_64-linux-gnu/gtk-3.0/3.0.0/immodules/im-fcitx5.so'
export const APPIMAGE_FCITX_GCLIENT_LIBRARY_PATH =
  'usr/lib/x86_64-linux-gnu/libFcitx5GClient.so.2'
export const DEFAULT_APPIMAGE_PLUGIN_URL =
  'https://github.com/linuxdeploy/linuxdeploy-plugin-appimage/releases/download/continuous/linuxdeploy-plugin-appimage-x86_64.AppImage'
export const APPIMAGE_HOST_LIBRARY_GLOBS = Object.freeze([
  'libsystemd.so*',
  'libudev.so*',
  'libdbus-1.so*',
  'libwayland-*.so*',
  'libepoxy.so*',
  'libnghttp2.so*',
])
export const LINUXDEPLOY_EXCLUDED_LIBRARIES = APPIMAGE_HOST_LIBRARY_GLOBS.join(';')

const WRAPPER_MARKER = 'Tolaria AppImage symlink launcher shim'
const APPIMAGE_PLUGIN_URL_TOKEN = '__TOLARIA_APPIMAGE_PLUGIN_URL__'
const APPIMAGE_HOST_LIBRARY_PREFIXES = APPIMAGE_HOST_LIBRARY_GLOBS.map((pattern) =>
  pattern.replace(/\*.*$/, ''),
)
const REQUIRED_APPIMAGE_PATHS = [
  'AppRun',
  APPIMAGE_FCITX_GTK3_IM_MODULE_PATH,
  APPIMAGE_FCITX_GCLIENT_LIBRARY_PATH,
]

export function tauriToolsCacheDir(env = process.env) {
  if (env.TOLARIA_TAURI_TOOLS_DIR) {
    return resolve(env.TOLARIA_TAURI_TOOLS_DIR)
  }

  if (env.XDG_CACHE_HOME) {
    return resolve(env.XDG_CACHE_HOME, 'tauri')
  }

  if (!env.HOME) {
    throw new Error('HOME or XDG_CACHE_HOME is required to locate the Tauri tools cache')
  }

  return resolve(env.HOME, '.cache', 'tauri')
}

export function patchAppRunText(text) {
  if (text.includes(BROKEN_LINUXDEPLOY_APPRUN_DIR_LINE)) {
    return {
      changed: true,
      text: text.replaceAll(
        BROKEN_LINUXDEPLOY_APPRUN_DIR_LINE,
        FIXED_LINUXDEPLOY_APPRUN_DIR_LINE,
      ),
    }
  }

  return { changed: false, text }
}

export function assertSymlinkSafeAppRunText(text, label = 'AppRun') {
  if (text.includes(BROKEN_LINUXDEPLOY_APPRUN_DIR_LINE)) {
    throw new Error(`${label} still resolves dirname before following AppRun symlinks`)
  }

  if (!text.includes(FIXED_LINUXDEPLOY_APPRUN_DIR_LINE)) {
    throw new Error(`${label} is missing the symlink-safe AppRun directory resolver`)
  }
}

export function findBundledHostLibraries(libraryPaths) {
  const matches = libraryPaths
    .map((libraryPath) => basename(libraryPath))
    .filter((name) => APPIMAGE_HOST_LIBRARY_PREFIXES.some((prefix) => name.startsWith(prefix)))

  return [...new Set(matches)].sort()
}

export function assertNoBundledHostLibraries(libraryPaths, label = 'AppImage') {
  const matches = findBundledHostLibraries(libraryPaths)
  if (matches.length > 0) {
    throw new Error(`${label} bundles host system libraries: ${matches.join(', ')}`)
  }
}

const APPIMAGE_PLUGIN_WRAPPER_SOURCE = `#!/usr/bin/env bash
set -euo pipefail

# ${WRAPPER_MARKER}
PLUGIN_URL="\${TOLARIA_APPIMAGE_PLUGIN_URL:-${APPIMAGE_PLUGIN_URL_TOKEN}}"
SCRIPT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
REAL_PLUGIN="\${TOLARIA_APPIMAGE_REAL_PLUGIN:-"$SCRIPT_DIR/${REAL_APPIMAGE_PLUGIN_NAME}"}"
FCITX_GTK3_IM_MODULE="\${TOLARIA_FCITX_GTK3_IM_MODULE:-/usr/lib/x86_64-linux-gnu/gtk-3.0/3.0.0/immodules/im-fcitx5.so}"
FCITX_LIBRARY_DIR="\${TOLARIA_FCITX_LIBRARY_DIR:-/usr/lib/x86_64-linux-gnu}"

appdir_from_args() {
  local previous=""

  for arg in "$@"; do
    if [ "$previous" = "--appdir" ]; then
      printf '%s\\n' "$arg"
      return 0
    fi

    case "$arg" in
      --appdir=*)
        printf '%s\\n' "\${arg#--appdir=}"
        return 0
        ;;
    esac

    previous="$arg"
  done
}

download_real_plugin() {
  if [ -x "$REAL_PLUGIN" ]; then
    return 0
  fi

  local tmp_plugin="$REAL_PLUGIN.tmp.$$"
  rm -f "$tmp_plugin"
  mkdir -p "$(dirname -- "$REAL_PLUGIN")"

  if command -v curl >/dev/null 2>&1; then
    curl -fsSL -o "$tmp_plugin" "$PLUGIN_URL"
  elif command -v wget >/dev/null 2>&1; then
    wget -q -O "$tmp_plugin" "$PLUGIN_URL"
  else
    echo "curl or wget is required to fetch the real linuxdeploy AppImage output plugin" >&2
    return 1
  fi

  chmod +x "$tmp_plugin"
  mv "$tmp_plugin" "$REAL_PLUGIN"
}

patch_apprun() {
  local appdir="\${APPDIR:-}"

  if [ -z "$appdir" ]; then
    appdir="$(appdir_from_args "$@" || true)"
  fi

  if [ -z "$appdir" ] || [ ! -f "$appdir/AppRun" ]; then
    return 0
  fi

  python3 - "$appdir/AppRun" <<'PY'
from pathlib import Path
import sys

path = Path(sys.argv[1])
broken = 'this_dir="$(readlink -f "$(dirname "$0")")"'
fixed = 'this_dir="$(dirname "$(readlink -f "$0")")"'
text = path.read_text(encoding="utf-8")

if broken in text:
    path.write_text(text.replace(broken, fixed), encoding="utf-8")
    print(f"Patched linuxdeploy AppRun symlink resolution in {path}", file=sys.stderr)
elif fixed in text:
    pass
elif "autogenerated by linuxdeploy" in text and "AppRun.wrapped" in text:
    raise SystemExit(f"{path} is a linuxdeploy wrapper but does not contain the expected AppRun resolver")
PY
}

bundle_fcitx_gtk3_module() {
  local appdir="\${APPDIR:-}"

  if [ -z "$appdir" ]; then
    appdir="$(appdir_from_args "$@" || true)"
  fi

  if [ -z "$appdir" ] || [ ! -d "$appdir" ] || [ ! -f "$FCITX_GTK3_IM_MODULE" ]; then
    return 0
  fi

  local module_dest="$appdir/${APPIMAGE_FCITX_GTK3_IM_MODULE_PATH}"
  local library_dest_dir="$appdir/usr/lib/x86_64-linux-gnu"

  mkdir -p "$(dirname -- "$module_dest")" "$library_dest_dir"
  cp -a "$FCITX_GTK3_IM_MODULE" "$module_dest"

  local copied_library=0
  shopt -s nullglob
  for lib in "$FCITX_LIBRARY_DIR"/libFcitx5GClient.so* "$FCITX_LIBRARY_DIR"/libFcitx5Utils.so*; do
    cp -a "$lib" "$library_dest_dir/"
    copied_library=1
  done
  shopt -u nullglob

  if [ "$copied_library" -eq 0 ]; then
    echo "No fcitx GTK client libraries found in $FCITX_LIBRARY_DIR" >&2
  fi
}

download_real_plugin
patch_apprun "$@"
bundle_fcitx_gtk3_module "$@"
exec "$REAL_PLUGIN" "$@"
`

export function appImagePluginWrapperSource({
  pluginUrl = DEFAULT_APPIMAGE_PLUGIN_URL,
} = {}) {
  return APPIMAGE_PLUGIN_WRAPPER_SOURCE.replace(APPIMAGE_PLUGIN_URL_TOKEN, () => pluginUrl)
}

export async function preparePluginWrapper({
  env = process.env,
  toolsDir = tauriToolsCacheDir(env),
} = {}) {
  await mkdir(toolsDir, { recursive: true })

  const wrapperPath = join(toolsDir, APPIMAGE_PLUGIN_WRAPPER_NAME)
  const realPluginPath = join(toolsDir, REAL_APPIMAGE_PLUGIN_NAME)

  if (existsSync(wrapperPath) && !existsSync(realPluginPath)) {
    const existing = await readFile(wrapperPath, 'utf8').catch(() => '')
    if (!existing.includes(WRAPPER_MARKER)) {
      await mkdir(dirname(realPluginPath), { recursive: true })
      await rename(wrapperPath, realPluginPath)
    }
  }

  await writeFile(wrapperPath, appImagePluginWrapperSource(), 'utf8')
  await chmod(wrapperPath, 0o755)

  return { realPluginPath, wrapperPath }
}

export async function validateAppRunFile(path) {
  const text = await readFile(path, 'utf8')
  assertSymlinkSafeAppRunText(text, path)
}

function extractAppImagePath(appImage, requiredPath, tempDir) {
  const result = spawnSync(appImage, ['--appimage-extract', requiredPath], {
    cwd: tempDir,
    encoding: 'utf8',
  })

  if (result.status === 0) {
    return
  }

  throw new Error(
    [
      `Failed to extract ${requiredPath} from ${appImage}`,
      result.stdout.trim(),
      result.stderr.trim(),
    ]
      .filter(Boolean)
      .join('\n'),
  )
}

function assertAppImagePathsExtracted(appImage, tempDir, requiredPaths) {
  for (const requiredPath of requiredPaths) {
    const extractedPath = join(tempDir, 'squashfs-root', requiredPath)
    if (!existsSync(extractedPath)) {
      throw new Error(`${appImage} is missing ${requiredPath}`)
    }
  }
}

function listExtractedLibraries(tempDir) {
  const result = spawnSync('find', ['squashfs-root/usr/lib', '-mindepth', '1', '-printf', '%P\\n'], {
    cwd: tempDir,
    encoding: 'utf8',
  })
  if (result.status !== 0) {
    throw new Error(`Failed to list extracted AppImage libraries: ${result.stderr.trim()}`)
  }
  return result.stdout.split('\n').filter(Boolean)
}

async function validateBundledLibraries(appImage, tempDir) {
  extractAppImagePath(appImage, 'usr/lib', tempDir)
  assertNoBundledHostLibraries(listExtractedLibraries(tempDir), appImage)
}

async function validateExtractedAppImage(appImage, tempDir) {
  for (const requiredPath of REQUIRED_APPIMAGE_PATHS) {
    extractAppImagePath(appImage, requiredPath, tempDir)
  }

  await validateAppRunFile(join(tempDir, 'squashfs-root', 'AppRun'))
  assertAppImagePathsExtracted(appImage, tempDir, REQUIRED_APPIMAGE_PATHS.slice(1))
  await validateBundledLibraries(appImage, tempDir)
}

async function validateEachAppImage(paths, validate) {
  if (paths.length === 0) {
    throw new Error('At least one AppImage path is required for launcher validation')
  }

  for (const appImage of paths.map((path) => resolve(path))) {
    const tempDir = await mkdtemp(join(tmpdir(), 'tolaria-appimage-'))
    try {
      await validate(appImage, tempDir)
    } finally {
      await rm(tempDir, { recursive: true, force: true })
    }
  }
}

export async function validateAppImages(paths) {
  await validateEachAppImage(paths, validateExtractedAppImage)
}

export async function validateAppImageLibraries(paths) {
  await validateEachAppImage(paths, validateBundledLibraries)
}

async function preparePluginCommand() {
  const { wrapperPath, realPluginPath } = await preparePluginWrapper()
  log(`Prepared ${wrapperPath}`)
  log(`Real plugin cache: ${realPluginPath}`)
}

async function validateAppRunFilesCommand(paths) {
  for (const path of paths) {
    await validateAppRunFile(path)
    log(`Validated ${path}`)
  }
}

async function validateAppImagesCommand(paths) {
  await validateAppImages(paths)
  for (const path of paths) {
    log(`Validated AppImage launcher in ${path}`)
  }
}

async function validateAppImageLibrariesCommand(paths) {
  await validateAppImageLibraries(paths)
  for (const path of paths) {
    log(`Validated AppImage host-library boundary in ${path}`)
  }
}

async function printLinuxdeployExclusionsCommand() {
  log(LINUXDEPLOY_EXCLUDED_LIBRARIES)
}

const COMMANDS = new Map([
  ['prepare-plugin', preparePluginCommand],
  ['print-linuxdeploy-exclusions', printLinuxdeployExclusionsCommand],
  ['validate-apprun-file', validateAppRunFilesCommand],
  ['validate-appimages', validateAppImagesCommand],
  ['validate-appimage-libraries', validateAppImageLibrariesCommand],
])

function usage() {
  return 'Usage: node scripts/appimage-launcher-tools.mjs prepare-plugin | print-linuxdeploy-exclusions | validate-apprun-file <AppRun...> | validate-appimages <AppImage...> | validate-appimage-libraries <AppImage...>'
}

async function main() {
  const [command, ...args] = process.argv.slice(2)
  const handler = COMMANDS.get(command)

  if (!handler) {
    throw new Error(usage())
  }

  await handler(args)
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    logError(error.message)
    process.exit(1)
  })
}
