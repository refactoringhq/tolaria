# Native tablet interaction tests

Date: 2026-10-10. Status: accepted.

## Context

Web rendering and transition-model tests cannot prove that native touch events
reach Gesture Handler through ScrollView or TenTap. The computer-use drag path
delivered touch-down without movement in this environment. The Mac may also be
locked during unattended work. Neither condition should produce a false QA pass.

## Decision

Add a small independent XCUITest runner for the installed standalone iPad app.
It uses Apple's native touch synthesis and accessibility frames to verify actual
panel movement and desktop-derived snap widths. Explicit launch arguments select
an isolated fixture. Tests must fail on absent controls or incorrect positions;
no JavaScript callbacks may substitute for physical gesture delivery.

Generate its Xcode project with the `xcodeproj` gem already used by CocoaPods.
Keep generated projects, derived data, and `.xcresult` bundles outside the repo.
Reinstall the disposable runner for every run: unsigned Xcode runner caching was
observed to execute an older test binary after a successful rebuild.

This is an additional scoped QA command, not part of every experimental commit.
It never removes the Tolaria app or changes vault/account data. It does not unlock
the host or interact with unrelated Mac applications.

## Consequences

Current-source standalone installation and a running Metro server are prerequisites.
The result bundle supplies screenshots and failed-action diagnostics. Passing
confirms tested native interactions, not frame-rate quality, text-selection
arbitration, physical-device behavior, Android, or large-vault performance. Keep
numeric layout checks, persistence probes, and device testing as separate gates.

API reference: [Apple's XCUIElement actions](https://developer.apple.com/documentation/xcuiautomation/xcuielement).
