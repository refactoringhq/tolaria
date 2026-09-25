---
type: ADR
id: "0182"
title: "App-owned cross-platform PDF rendering"
status: active
date: 2026-09-25
amends: "0121"
---

## Context

Tolaria previously embedded vault PDFs with an HTML `<object>` and delegated rendering to the desktop webview. CSP and cache-busting fixes made that path reliable where a native PDF plugin existed, but Linux WebKitGTK and some Windows WebView2 installations do not provide a usable embedded PDF renderer. Those runtimes display an empty white rectangle even though the Tauri asset request succeeds.

The preview must behave consistently across supported desktop targets, keep large and multi-page documents responsive, preserve vault-scoped asset access, and retain the external-open fallback for corrupt or unsupported documents.

## Decision

**Tolaria owns PDF rendering in the renderer with the bundled `pdfjs-dist` dependency instead of relying on a webview PDF plugin.**

- `PdfFilePreview` loads vault-scoped Tauri asset URLs through PDF.js and renders pages to canvas.
- The first page renders eagerly. Later pages use intersection-based lazy rendering with a generous prefetch margin, so large documents do not allocate every canvas immediately.
- PDF.js and its worker are bundled with the app. The production CSP permits the self-hosted worker and scoped asset fetches without allowing remote worker code.
- Closing or switching a preview cancels active page rendering and destroys the PDF.js document.
- Load or render failures reuse `FilePreview`'s existing external-open fallback and categorical failure telemetry; no filename or path is sent to analytics.
- The obsolete object/frame asset allowances are removed from the CSP. `object-src` is set to `none`, while the existing isolated HTML frame sources remain unchanged.
- ADR-0121's Linux AppImage external fallback remains in force for audio and video only; PDFs now use the same app-owned path on every desktop platform.

## Alternatives considered

- **Keep the native `<object>` renderer**: smallest implementation, but cannot satisfy Linux and affected Windows installations because the required viewer is outside Tolaria's control.
- **Open PDFs only in the default application**: reliable but removes the in-context preview promised by the file-preview model.
- **Render PDFs in Rust with a native PDF library**: could work, but adds platform-specific native binaries and release packaging complexity for behavior PDF.js already provides portably.

## Consequences

- PDF rendering is consistent across macOS, Windows, and Linux webviews and no longer depends on an installed browser PDF plugin.
- The frontend bundle gains PDF.js and a worker asset; lazy loading keeps them off the initial application path.
- Large documents consume canvas memory only around the viewport, while multi-page documents remain scrollable in the existing preview pane.
- Vault-scoped Tauri asset URLs remain the data boundary, and broken PDFs still have an explicit default-app escape hatch.
