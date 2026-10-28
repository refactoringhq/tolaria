# Supported Platforms

Source: reference/supported-platforms.md
URL: /reference/supported-platforms

# Supported Platforms

Tolaria is available on desktop (built with Tauri) and mobile (React Native with Expo). Releases currently target macOS, Windows, Linux, iPhone, and iPad.

| Platform | Current support | Notes |
| --- | --- | --- |
| macOS | Primary | Main development and QA target. Apple Silicon and Intel artifacts are published. |
| Windows | Supported, early | NSIS installers and signed updater bundles are published. Menu, shell-path, and credential-helper behavior receive platform-specific fixes as they appear. |
| Linux | Supported, early | AppImage, deb, and RPM artifacts are published. Behavior can depend on distro WebKitGTK packages, Wayland/X11 details, and input-method setup. |
| iOS (iPhone, iPad) | Beta | Public beta via [TestFlight](https://testflight.apple.com/join/7aPD4GAB). WYSIWYG editor, real git sync, iCloud/Files integration. |

## Support Policy

Primary support means the platform is part of normal development and release validation. Supported, early means release artifacts exist and the app is expected to work, but platform-specific bugs can take longer to diagnose than macOS issues. Beta means the platform is under active development with core features working but not all desktop features implemented yet.

## Mobile vs Desktop Features

The iOS app (iPhone and iPad) currently focuses on core note editing and sync:

- ✅ WYSIWYG Markdown editing with TenTap/Tiptap
- ✅ Git auto-commit and merge support
- ✅ Sync through iCloud or Files
- ✅ GitHub repository integration
- ⏳ Desktop-only: AI panel, advanced search, some desktop power-user features are not yet on mobile

The mobile app shares the same vault format and git repository as the desktop app, so you can seamlessly work across devices.

## Reporting Platform Bugs

Include:

- Tolaria version.
- Operating system and version.
- CPU architecture.
- Whether the vault is local-only or connected to a remote.
- Steps to reproduce.