# Release Channels

Source: reference/release-channels.md
URL: /reference/release-channels

# Release Channels

Tolaria publishes Stable and Alpha release metadata to GitHub Pages.

## Stable

Stable follows manually promoted releases. This is the right channel for normal use.

The stable updater metadata lives at:

```txt
/stable/latest.json
```

The public download page points at the latest stable release.

## Alpha

Alpha follows pushes to `main`. It receives fixes and features earlier, but it can be rougher than Stable.

The alpha updater metadata lives at:

```txt
/alpha/latest.json
```

Compatibility endpoints also point to the alpha metadata:

```txt
/latest.json
/latest-canary.json
```

## Mobile Channels

The iPhone and iPad app has its own Release channel setting with **Stable** (the default) and **Alpha**. The channel decides which over-the-air (OTA) updates the app downloads; it does not change the app build you installed.

- Mobile Alpha updates are published from `main` after CI passes, like desktop Alpha.
- Mobile Stable updates are published manually.
- The app checks for an update when it launches and again when you return to it. A downloaded update applies on the next launch, or right away with **Restart now** in Settings.
- OTA updates only cover JavaScript changes compatible with your installed build. Native changes need a new app build from TestFlight.

## Before Switching

Commit or push important vault changes before changing release channel or installing an update. Your notes are local files, but a clean Git state makes recovery simpler.