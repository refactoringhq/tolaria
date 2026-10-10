# Mobile resumption assessment

Assessment started 2026-10-10. Target: iPad and Android tablets, phone later.

## Recovered baseline

The task reopened at detached June commit `ca79c12ff`. The maintained August
implementation was recovered from `origin/mobile-ui-foundation` (`c97be7326`).
The divergent older local branch is preserved as
`backup/mobile-local-before-resume-2026-10-10`. No desktop work was discarded.

The simulator's installed standalone app predates that branch. It is not valid
evidence for the current source. Current-source native checks use Expo Go 54;
custom native-module changes require a rebuilt development app, separately.

## Assessment

| Area | Current evidence | Decision |
| --- | --- | --- |
| Desktop visual language | Shared parity tokens, explicit native layout styles, native note selection and properties toggle work | Keep; do not redesign from Bear screenshots |
| Editor | TenTap WYSIWYG with Markdown/frontmatter serialization and extensive model tests | Keep; add an awaitable save barrier before checkout or switching vaults |
| Tablet panels | PanResponder event ownership was recomputed during drag; animation interruption used settled rather than presented positions | Fix correctness; native UI-thread gesture recognition is still needed for predictable performance |
| Native gestures | Automated coordinate drags have not yet established reliable continuous manipulation | Not passed; screenshots and transition-model tests are insufficient |
| Local folders | iOS picker copies into Documents; imported copy cannot track later iCloud edits | Separate import from live-folder access; never advertise the copy as cloud sync |
| Native persistence | Filesystem writes work, but some operations silently return on invalid paths; many reads are synchronous | Harden error handling and serialize writes with Git before enabling checkout |
| Remote sync | No Git implementation or GitHub login in the recovered branch; local snapshots report Synced | Launch blocker; use a real library and explicit local/pending/synced/error states |
| Android | No Android workspace module or current emulator evidence | Not validated; do not infer readiness from iOS or web |
| QA | Many pure-model and web tests, numerous native probes, but historical artifacts are temporary paths | Record current native evidence and numeric layout checks per batch |
| Build reproducibility | Fresh pnpm install failed native bundling because NativeWind's JSX Babel plugin was undeclared | Declare it directly; verify both native bundle and web export |

## Delivery order

1. Reproducible tablet baseline and core interaction corrections.
2. Embedded Git, safe checkpoints, real HTTP round-trip tests, credential isolation.
3. Vault manager and native storage integration, save/checkout barrier, honest sync UI.
4. Live-folder provider access: durable iOS scope/coordinated IO and persisted Android
   SAF permissions. External changes must refresh without overwriting dirty notes.
5. Tablet usability pass with representative data: keyboard, scroll/drag arbitration,
   rotation, split-screen, modal sizing, text sizes, touch targets, and accessibility.
6. Device validation and measured large-vault budgets before launch promotion.

Manual Git sync is the first scope. Divergence stops with both histories intact;
no forced pushes or hidden conflict resolution. Background sync, rich on-device
conflict editing, multi-vault use, and phone polish are not first-launch prerequisites.

## Evidence log

- Starting CodeScene project scores: Hotspot 10.0, Average 9.991289335928062;
  branch thresholds 10.0 and 9.99 pass.
- Gesture regression tests were first observed failing for interrupted offsets
  and properties stealing drags outside its bounds; then passed after fixes.
- Git tests use disposable actual Git repositories, not mock object graphs.
  Clone/push/pull, divergence preservation, rejected-push retry, file deletion,
  frontmatter preservation, and binary-byte preservation pass locally.
- Native Expo Go 54 current bundle renders sidebar rows, note rows, properties,
  and WYSIWYG content. Clicking a note changes the editor and inspector; the
  properties button toggles the panel. Continuous drag remains under investigation.
- Codacy ESLint wrapper lacked its TypeScript parser and is not counted as a
  successful scan. Project ESLint passes. Codacy Opengrep succeeds with UTF-8
  locale settings and reports no findings in the first core implementation scan.

## Second batch

- Committed Git foundation: `ccb2b8a30`. Verified hooks passed 1,121 mobile tests.
  Real Git subprocesses explicitly remove inherited `GIT_*` settings; hooks had
  previously contaminated the disposable HTTP fixture's repository discovery.
- Replaced tablet PanResponder with Gesture Handler/Reanimated worklets. No
  per-frame React state or JavaScript-thread movement callbacks. Preserved existing
  dimensions, toolbar actions, and the left strip's sequential snap points.
- Native Expo Go 54 layout assertion passed **204 metrics** on the booted iPad Pro
  13-inch simulator, using the current Metro bundle and all-panels fixture.
- Instrumented native input during CUA drag attempts: a touch-down arrived but no
  touch-move callbacks followed. This does not establish a real gesture pass.
  Temporary logging was removed. Physical-touch interaction remains unverified.
- Moved the dependency store's `v10` cache to
  `/Volumes/Jupiter/Cache/tolaria-pnpm-store-internal-v10-20261010` with a symlink
  at its original location, preserving it and recovering internal disk space.
  Removed only temporary repositories created by this run.

## Native Git batch

- `node apps/mobile/scripts/assert-native-git.mjs` creates a disposable smart-HTTP
  Git server and starts the current bundle in Expo Go on the booted simulator.
  The in-app probe is development-only and accepts only a loopback test endpoint.
- Actual Hermes/Expo filesystem clone, commit, push, and pull passed on iPad:
  frontmatter, binary bytes, a nested attachment, and deletion survived the round
  trip. The small fixture completed in 1,837 ms; this is not a large-vault budget.
- Native-only fixes: provide the global Buffer required by the Git library;
  convert Buffer subclasses to plain Uint8Array at Expo's JSI write boundary;
  report missing parents as ENOENT; normalize harmless `.` path segments while
  still rejecting traversal outside the working copy.
- Touched code remains CodeScene 10.0; the Buffer initializer has no scorable code
  and zero findings. No UI copy or analytics changes in this internal batch.

This is a working assessment, not a release-readiness declaration. Native Git
transport is proven for a small fixture, not live GitHub authentication, large
vault throughput, Android, or file-provider behavior.

## Save-boundary batch

- Added ordered failed-write retention, shared with Git's actual-root operation
  key. Tests prove failed saves stop checkout and retries do not replay successful
  mutations or overwrite newer edits with older content.
- Added awaitable editor preparation and stale-reply suppression. TenTap freezes
  input before its final JSON read; source editors flush and freeze their draft.
  The registry still needs wiring into the vault-manager sync owner.
- Native workspace persistence passed. Native WYSIWYG persistence and 140 layout
  assertions passed after fixing the probe to wait for TenTap readiness, rather
  than relying on a 1.5-second startup assumption.
- Source editor CodeScene improved from 8.87 to 9.68 by separating its style
  groups; remaining touched/new code is 10.0. Scoped Opengrep: zero findings for
  the save boundary. The earlier native Git probe scan flags its proof POST as
  potential SSRF; reviewed as a development-only, loopback-validated fixture
  callback with generated data and no credentials or user-vault access.
- No UI copy changes or analytics events: these are internal persistence fixes.

## Vault-manager batch

- Native Expo Go cloned `isomorphic-git/lightning-fs` over real GitHub HTTPS from
  the new vault manager. The README opened in TenTap, a full app restart restored
  the vault, and reading the note left its working copy clean. No remote push was
  attempted against that public repository.
- A nonexistent-repository clone returned a visible error and preserved the
  previous vault and selected note. The local filesystem catalog contains only
  the successfully cloned vault; failed clone directories are removed.
- Catalog publication retains a validated backup. Regression tests cover an
  interrupted publish and an unrecoverable corrupt catalog. Authentication tests
  cover late restoration, cancelled authorization, and sign-out during listing.
- The sync owner now uses the editor/disk barrier. After replacement, callbacks
  from an old workspace generation cannot write. An edit clears the last sync
  success; local folders no longer claim remote synchronization.
- CodeScene: source editor 9.68 -> 10.0, keyboard shortcuts 8.45 -> 9.38;
  other touched code remains 10.0 and new scorable code reaches 10.0.
- Localization: Lara translated 19 configured targets; the existing Belarusian
  Latin catalog was also updated. Validation passes all 21 catalogs.
- Scoped Codacy Opengrep reviewed 56 files: two audit findings. The generated
  vault suffix is not a credential or security boundary (exclusive directory
  creation rejects collisions); shortcut dispatch uses a closed action union,
  and untrusted key lookup now uses Map to exclude inherited object properties.
  Neither finding represents a new Critical/High security defect.
- PostHog is intentionally not enabled in this experimental mobile build: mobile
  consent/settings integration is absent. No vault, account, or note data is sent
  as analytics. Instrumentation remains a release-readiness task.
- GitHub sign-in remains unverified and explicitly unavailable without
  `EXPO_PUBLIC_GITHUB_CLIENT_ID`. Live folders, Android, and large-vault sync
  performance remain open work, not implied by the public clone success.

## Filesystem safety batch

- A native regression first reproduced silently successful moves when the source
  was missing or the destination already existed. These now reject without
  changing either file. Mutation paths reject traversal and `.git` access.
- The repository validates the complete write plan before queuing it, rejects a
  missing root, and awaits asynchronous filesystem operations before Git can
  read the working copy. Targeted repository coverage: 14 tests passed.
- The same assertions run inside the native Git probe, which passed in Expo Go
  on the iPad simulator (1,758 ms for the small disposable round trip).
- No UI copy or analytics changes; this is persistence correctness, not a new
  user action. Live file-provider access still requires the standalone build.
