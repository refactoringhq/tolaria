#!/usr/bin/env bash
# Installs Ubuntu packages on CI without letting a slow package mirror stall a job.
# Main's rust-lint job once spent its whole hour on `apt-get update` because
# archive.ubuntu.com served the package lists at a few bytes per second (TOL-442).
# Each apt-get call is now capped; after a failed or timed-out attempt the remaining
# attempts switch the Ubuntu archive to a fallback mirror. The install still
# fails when no attempt succeeds.
# `timeout --foreground` keeps sudo in the step's foreground process group: from a
# background group, sudo stopped on SIGTTOU while restoring CircleCI's pty after
# apt-get finished, and the job hung until the no-output limit.
#
# Usage: bash scripts/ci-apt-install.sh [apt-get install option]... <package>...
set -euo pipefail

if (( $# == 0 )); then
  echo "usage: ci-apt-install.sh <package>..." >&2
  exit 2
fi

attempts="${CI_APT_ATTEMPTS:-3}"
attempt_timeout="${CI_APT_ATTEMPT_TIMEOUT:-600}"
retry_delay="${CI_APT_RETRY_DELAY:-10}"
fallback_mirror="${CI_APT_FALLBACK_MIRROR:-http://mirrors.edge.kernel.org/ubuntu}"
sources_glob="${CI_APT_SOURCES:-/etc/apt/sources.list /etc/apt/sources.list.d/*.list /etc/apt/sources.list.d/*.sources}"
read -ra sudo_args <<< "${CI_APT_SUDO-sudo -E}"
apt_options=(-o Acquire::Retries=3 -o Acquire::http::Timeout=30 -o Acquire::https::Timeout=30)

# Keep needrestart from opening an interactive prompt on machine images.
export DEBIAN_FRONTEND=noninteractive NEEDRESTART_MODE=a

apt_get() {
  timeout --foreground --kill-after=30 "$attempt_timeout" "${sudo_args[@]}" apt-get "${apt_options[@]}" "$@"
}

install_packages() {
  apt_get update && apt_get install -y "$@"
}

use_fallback_mirror() {
  local source
  for source in $sources_glob; do
    [[ -f "$source" ]] || continue
    "${sudo_args[@]}" sed -i -E \
      "s#https?://([a-z0-9-]+\\.)*archive\\.ubuntu\\.com/ubuntu/?#${fallback_mirror}/#g" "$source"
  done
  echo "Switched the Ubuntu archive to ${fallback_mirror}" >&2
}

for ((attempt = 1; attempt <= attempts; attempt++)); do
  if install_packages "$@"; then
    exit 0
  fi
  echo "apt install attempt ${attempt}/${attempts} failed or exceeded ${attempt_timeout}s" >&2
  if (( attempt < attempts )); then
    use_fallback_mirror
    sleep "$retry_delay"
  fi
done

echo "apt install failed after ${attempts} attempts" >&2
exit 1
