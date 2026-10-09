---
type: ADR
id: "0184"
title: "Host-compatible AppImage library boundary"
status: active
date: 2026-10-07
supersedes: "0117"
---

## Context

Tolaria AppImages are built on Ubuntu 22.04 so their application dependencies remain compatible with older supported distributions. Tauri CLI 2.11's linuxdeploy path nevertheless copied several host-owned system libraries into the image. On Ubuntu 26.04, the bundled `libsystemd.so.0` was loaded into the host `/usr/bin/env` process and failed because it lacked the host's `LIBSYSTEMD_254` symbol version. The same mixed-library boundary had already caused Wayland/Mesa and system Git/libnghttp2 failures.

Core GTK and GLib libraries remain a coherent private application stack because removing them can break older distributions. Low-level service, display, and networking libraries instead belong to the host because host executables, drivers, and modules must load a matching version family.

## Decision

**Build Linux AppImages with Tauri CLI 2.12.1 or newer, exclude host-owned system-library families through linuxdeploy, and reject sealed AppImages that contain any excluded family.**

The exclusion boundary covers systemd/udev, D-Bus, Wayland, epoxy, and nghttp2. Both release build paths (the CircleCI Linux job and the reusable GitHub Actions artifact workflow) export the exclusion list as `LINUXDEPLOY_EXCLUDED_LIBRARIES` and then run `validate-appimage-libraries`, which extracts each finished AppImage and checks the library inventory alongside the existing updater-signature and installer checks. The stricter `validate-appimages` command also requires the symlink-safe AppRun and fcitx payload produced only by the experimental output-plugin shim, so it is not a gate for stock packaging. Tauri's stock updated GTK plugin remains responsible for GTK modules; Tolaria does not replace the output plugin in Tauri's tools cache.

## Options considered

- **Updated stock Tauri bundler plus explicit exclusions and sealed-artifact inspection** (chosen): keeps updater signing inside Tauri, uses upstream linuxdeploy support, and makes regressions visible before publication.
- **Post-process and repack the AppImage**: can remove arbitrary files, but invalidates Tauri's updater artifact/signature flow unless the release job reconstructs and re-signs every related artifact.
- **Exclude GTK and GLib as well**: reduces bundling, but makes older supported distributions depend on newer host ABI combinations and contradicts the community compatibility guidance.
- **Restore the custom output-plugin wrapper**: permits pre-seal mutation, but previously caused linuxdeploy to exit before producing an AppImage.

## Consequences

- Current distributions use their own systemd, udev, D-Bus, Wayland, epoxy, and nghttp2 libraries instead of stale Ubuntu 22.04 copies.
- Ubuntu 22.04 remains the oldest release-build and launch target, so every excluded family must be available through the supported desktop runtime.
- A Tauri/linuxdeploy change that reintroduces an excluded library fails the Linux release before upload.
- Upgrading Tauri alone is not sufficient: a Tauri CLI 2.12.1 build without the exclusion export still bundles libsystemd, libudev, libdbus-1, libepoxy, libnghttp2, and three libwayland libraries, and reproduces the `LIBSYSTEMD_254` and nghttp2 symbol failures on Ubuntu 26.04.
- The Linux QA matrix must launch the sealed artifact on an older LTS and a current distribution, covering X11/Wayland where available plus MCP, system Git, updater metadata, and symlinked launch behavior.
- Re-evaluate the explicit exclusion list when upstream Tauri exposes an AppImage library policy or its default list provably covers the same boundary.
