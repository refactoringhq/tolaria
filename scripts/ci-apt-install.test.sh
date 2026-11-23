#!/usr/bin/env bash
# Regression guard for TOL-442: main's rust-lint job timed out after an hour
# because `apt-get update` crawled on a slow Ubuntu mirror. The CI apt helper
# must cap each apt-get call, retry on a fallback mirror, and still fail when
# every attempt fails. It must also finish on a terminal: CircleCI steps run on a
# pty, and sudo stalled restoring that terminal when `timeout` had moved it into
# a background process group, so every Rust job hung after apt-get completed.
set -euo pipefail

cd "$(dirname "$0")/.."
helper=scripts/ci-apt-install.sh
failures=0
work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT

pass() { echo "ok - $1"; }
fail() { echo "not ok - $1" >&2; failures=$((failures + 1)); }

# Fake apt-get: logs each call with the mirror currently in sources.list.
# FAKE_APT_MODE: ok | hang (sleep past the timeout on the slow mirror) | broken
# | tty (restore the terminal settings on exit, as sudo does on CircleCI).
mkdir -p "$work/bin"
cat > "$work/bin/apt-get" <<'FAKE'
#!/usr/bin/env bash
mirror=$(awk '{print $2; exit}' "$FAKE_APT_DIR/sources.list")
echo "$mirror $*" >> "$FAKE_APT_DIR/calls.log"
case "$FAKE_APT_MODE" in
  hang) [[ "$mirror" == *archive.ubuntu.com* ]] && sleep 30 ;;
  broken) exit 100 ;;
  tty) stty "$(stty -g)" ;;
esac
exit 0
FAKE
chmod +x "$work/bin/apt-get"

stage() {
  local dir="$work/$1"
  mkdir -p "$dir"
  echo 'deb http://archive.ubuntu.com/ubuntu/ jammy main universe' > "$dir/sources.list"
  echo 'deb http://security.ubuntu.com/ubuntu/ jammy-security main' >> "$dir/sources.list"
  : > "$dir/calls.log"
  echo "$dir"
}

run_helper() {
  local dir="$1" mode="$2"
  shift 2
  FAKE_APT_DIR="$dir" FAKE_APT_MODE="$mode" PATH="$work/bin:$PATH" \
    CI_APT_SUDO="" CI_APT_SOURCES="$dir/sources.list" \
    CI_APT_ATTEMPTS=3 CI_APT_ATTEMPT_TIMEOUT=1 CI_APT_RETRY_DELAY=0 \
    CI_APT_FALLBACK_MIRROR=http://mirror.test/ubuntu \
    bash "$helper" "$@" > "$dir/out.log" 2>&1
}

# Runs the helper on a fresh pseudo-terminal, like a CircleCI step, with the
# real attempt timeout so a stalled terminal shows up as a timeout.
run_helper_on_tty() {
  local dir="$1"
  FAKE_APT_DIR="$dir" FAKE_APT_MODE=tty PATH="$work/bin:$PATH" \
    CI_APT_SUDO="" CI_APT_SOURCES="$dir/sources.list" \
    CI_APT_ATTEMPTS=1 CI_APT_ATTEMPT_TIMEOUT=5 CI_APT_RETRY_DELAY=0 \
    script -qec "bash $helper pkg-a" /dev/null > "$dir/out.log" 2>&1
}

calls() { wc -l < "$1/calls.log" | tr -d ' '; }

dir=$(stage healthy)
if run_helper "$dir" ok --no-install-recommends pkg-a pkg-b \
  && [[ "$(calls "$dir")" == 2 ]] \
  && grep -q 'install -y --no-install-recommends pkg-a pkg-b' "$dir/calls.log" \
  && grep -q 'archive.ubuntu.com' "$dir/sources.list"; then
  pass "installs once on a healthy mirror and leaves sources alone"
else
  fail "installs once on a healthy mirror and leaves sources alone"
fi

dir=$(stage slow)
if run_helper "$dir" hang pkg-a \
  && grep -q '^http://mirror.test/ubuntu/ .*install -y pkg-a' "$dir/calls.log" \
  && grep -q 'deb http://mirror.test/ubuntu/ jammy main universe' "$dir/sources.list" \
  && grep -q 'security.ubuntu.com' "$dir/sources.list"; then
  pass "times out on a stalled mirror and installs from the fallback mirror"
else
  fail "times out on a stalled mirror and installs from the fallback mirror"
fi

dir=$(stage broken)
if ! run_helper "$dir" broken pkg-a \
  && [[ "$(calls "$dir")" == 3 ]] \
  && grep -q 'apt install failed after 3 attempts' "$dir/out.log"; then
  pass "fails after the last attempt when apt keeps failing"
else
  fail "fails after the last attempt when apt keeps failing"
fi

dir=$(stage terminal)
if run_helper_on_tty "$dir" && [[ "$(calls "$dir")" == 2 ]]; then
  pass "finishes when apt-get restores the terminal on a CI pty"
else
  fail "finishes when apt-get restores the terminal on a CI pty"
fi

dir=$(stage usage)
if ! run_helper "$dir" ok && [[ "$(calls "$dir")" == 0 ]]; then
  pass "rejects a call without packages"
else
  fail "rejects a call without packages"
fi

if (( failures > 0 )); then
  echo "$failures ci-apt-install check(s) failed" >&2
  exit 1
fi
echo "ci-apt-install checks passed"
