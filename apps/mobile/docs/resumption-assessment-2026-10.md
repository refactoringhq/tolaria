# Mobile resumption assessment

Assessment started 2026-10-10. Target: iPad and Android tablets, phone later.

## Current checkpoint

- Follow-through is underway: recoverable Git checkout now passes real write-fault
  and restart tests, including the standalone iPad filesystem. Incomplete checkout
  cannot be edited or checkpointed as new user content. This does not yet provide
  a general crash-safe editor mutation journal.
- Current-source standalone iPad app rebuilt and installed. Native touch tests
  pass eight panel transitions and vertical-pan non-collapse. Native WYSIWYG
  persistence and 140 numeric layout checks pass after the final rebuild.
- Scoped mobile gates pass 1,170 tests across 186 files; 17 Swift filesystem
  tests passed in the native storage batch. No full desktop suite was run.
- Public GitHub cloning, persisted vault selection, and real native Git
  push/pull against a disposable server work. The simulator uses an isolated
  6,036-file Laputa copy, not the original vault.
- Not launch-ready: a 6,000-file debug fixture still takes 68-75 seconds
  for manual push or pull. Linked original folders, configured/live GitHub
  authentication, Android device QA, and October-main integration remain open.
- The table and evidence below are chronological, starting with the recovered
  baseline; later batches supersede the earlier observations.

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

### Approved follow-through

- [x] Recover interrupted Git checkout before reopening or checkpointing.
- [ ] Reduce measured large-vault sync cost without missing rapid edits.
- [ ] Durable editor-write recovery, deletion recovery, and incremental startup.
- [x] Contextual native formatting toolbar with measured touch targets.
- [ ] Tablet properties/forms touch polish.
- [ ] Gesture interruption/selection tests, adaptive layouts, and focus restoration.
- [ ] Live provider folders, configured GitHub login, and actionable sync recovery.
- [ ] Consolidated shared design tokens and parity audit against current desktop.
- [ ] Release-device performance budgets, accessibility, and Android tablet QA.

The first recovery batch started at Hotspot 10.0 / Average 9.991289335928062.
All touched/new code remains 10.0. Scoped Git tests passed 45 assertions, and the
standalone iPad proof verified real interrupted checkout, read/write exclusion,
retry, binary/deletion preservation, and remote round trips. Codacy reviewed the
existing loopback QA callback, Git SHA-1 test vector, and non-security catalog ID
suffix findings; no new security defect was introduced. No UI copy changed and
no analytics event is needed for internal recovery guards. See ADR 0201.

The next filesystem batch reuses bounded native path handles (never cached bytes
or timestamps), and enumerates directory names through Expo's supported async
API instead of constructing every child as a native File. The identical 6,000-file
fixture passed: clones 41,640/54,714 ms, push 75,298 ms, pull 68,296 ms, total
241,985 ms. Previous total was 404,585 ms. These are single debug-simulator runs,
not release budgets; metadata calls still dominate the sampled native profile.
Three adapter tests verify fresh metadata/content, byte views, path containment,
and filesystem errors. Both adapter files score 10.0. Codacy's nine audit findings
are non-literal paths in the disposable Node test adapter, not production file
access defects; none were suppressed. No copy/analytics changes.

Manual Git sync is the first scope. Divergence stops with both histories intact;
no forced pushes or hidden conflict resolution. Background sync, rich on-device
conflict editing, multi-vault use, and phone polish are not first-launch prerequisites.

### Contextual toolbar batch

- Four primary formatting actions plus heading/list/insert/more menus replace the
  native WYSIWYG command strip. Table commands appear only in table context. The
  source toolbar and existing command semantics remain unchanged (ADR 0202).
- RNR primitives own dropdown behavior. Native tap QA reproduced an iOS
  accessibility grouping bug that hid individual items; the wrapper now exposes
  each command. XCUITest then passed heading application, selected-state reporting,
  outside dismissal, a second menu, and subsequent inspector toggling. Existing
  eight-transition panel drag coverage also passes: two tests, 59.7 seconds.
- Native numeric layout check: 181 metrics passed. Native WYSIWYG persistence
  and its 117 metrics passed. Controls measure 44 x 44 points, menus at least
  44 points per row. These are explicit tablet touch exceptions, not invented
  desktop padding. No browser check is substituted for the native results.
- CodeScene: native layout assertions 8.03 -> 8.28; other touched/new scorable
  files 10.0. The command-data module and Ruby generator have no scorable code
  and zero findings. Scoped Codacy Opengrep: 15 files, zero findings.
- Lara translated the four menu labels into 19 targets; Belarusian Latin was
  updated too, and validation passes all 21 catalogs. Mobile analytics remains
  intentionally disabled pending consent/settings integration; no note content
  or account data was instrumented. Demo and original user vaults are unchanged.
- VoiceOver traversal, Android, physical devices, and the rest of the approved
  adaptive-layout/form work remain unverified. This is not launch sign-off.

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

## Standalone QA and provider-file foundation

- Built and installed the current-source standalone iPad app, rather than testing
  the old August binary or substituting the browser for native QA.
- Reproduced a standalone QA harness failure: JavaScript persistence proofs were
  visible in Metro but absent from the iOS unified log. The loopback collector now
  carries both metrics and known proof events. The standalone app passed all 140
  layout assertions and the native WYSIWYG save/persistence proof after this fix.
- Added a Foundation-only Swift package: nine real-filesystem tests cover atomic
  writes, SHA-256 revision checks, external edits/deletions, create collisions,
  special and Unicode filenames, symlinks, traversal, and bookmark restoration.
  The DEBUG-only native bridge can run disposable iOS file-access checks too.
- This is storage groundwork, not a live-folder feature claim. Picker integration,
  refresh/indexing, directory mutations, and conflict recovery remain required
  before exposing original provider files to editing (ADR 0198).
- The Mac locked during unattended work. Interactive CUA QA stopped; simulator
  instrumentation and builds continued without attempting to unlock it. No
  additional continuous-gesture verification is claimed.
- Android setup is absent: no SDK/emulator and only an old x86 Java 8 runtime.
  Android tablet QA remains a separate required gate.
- Touched and new scorable files score 10.0. Scoped Codacy found only the already
  reviewed development-loopback Git proof callback warning, not a new security
  defect. No UI copy changed; no product analytics event is appropriate for this
  internal QA/storage groundwork. Demo fixtures and the original Laputa vault
  remain untouched.
- Standalone iOS verification passed all five file-access checks plus the real
  Git round trip (2,634 ms for the disposable fixture). Restoring the existing
  app-local copy measured 6,036 files: 1,414 ms native read and 1,601 ms JavaScript
  snapshot construction. These are debug-run baselines, not a release performance
  budget or proof of fast large-vault Git sync. No original vault files were read
  or written during this measurement.

## Folder access disclosure

- The vault manager now distinguishes the standalone local-copy importer from
  Expo Go's session-only access to original files. It no longer promises that
  Expo Go edits cannot affect the original folder.
- A failing legacy managed importer rejects instead of falling back to the
  original picked root. The regression reproduced that fallback before the fix;
  all nine picker tests pass afterwards. Native picker cancellation still keeps
  the current vault.
- The new warning was translated with Lara into all 19 configured targets; the
  existing Belarusian Latin catalog was updated too. This is a safety correction,
  not a new user action requiring a product analytics event.

## Native launch source correction

- Final simulator inspection caught fixture notes after a `source=native` launch.
  The URL resolver recognized only `native-vault` and defaulted every unknown
  source to fixtures. Four failing cases reproduced this and inherited-object
  lookup for `constructor`/`__proto__`.
- Source lookup now uses Map, accepts `native`, and defaults unknown native
  launches to the real repository. Explicit fixtures and isolated QA routes still
  work. All 19 resolver tests pass. The corrected simulator launch shows the
  imported Laputa copy with 5,867 open entries and 169 archived entries.
- No localization or product analytics changes for this launch-routing fix.

## Read and import safety

- Reproduced empty-content fallback for invalid text, silent missing-root reads
  on iOS, and import/restore failures being mistaken for cancellation or first launch.
  These now reject. A staged import must validate fully before replacing the
  previous managed folder; visible symlinks and recursive self-import are rejected.
- Extracted the native index/import functions for real-filesystem testing. All
  17 Swift tests pass, including preserving the previous vault after invalid imports.
  The rebuilt standalone app passes the invalid-text proof, missing-root checks,
  and the actual Git round trip (1,981 ms for the small disposable fixture).
- Added a workspace error boundary with vault-management recovery controls. Failed
  reads cannot leave a blank editable document or remove access to vault selection.
  React DOM recovery coverage and the focused bridge/repository tests pass.
- Touched/new scorable files remain 10.0. Scoped Codacy Opengrep reports zero
  findings. Existing localized recovery copy is reused; no new product analytics
  event is appropriate for this data-safety correction. Original Laputa and demo
  fixtures remain untouched. Live provider integration is still not enabled.

## Repeatable native gesture verification

- A fresh standalone XCUITest runner passed eight actual panel transitions plus
  vertical-pan non-collapse in 31.9 seconds. It asserts native editor positions
  at x=600, x=340, and x=0, and a 300-point inspector, using actual touch synthesis.
  This supersedes the earlier inability to deliver continuous drag events via CUA.
- Caught and corrected two QA-harness problems: querying `isHittable` on an absent
  element caused retries/timeouts, and Xcode reused an old unsigned runner after
  rebuilding. The committed runner checks existence first and reinstalls itself
  before every run. Tolaria app data is never removed.
- The repository command, not only the temporary prototype, passed. Final native
  WYSIWYG persistence and all 140 layout assertions also passed on the rebuilt app.
  These results do not establish animation frame rate, interrupted drags, text
  selection arbitration, Android, or physical-device behavior.
- New scorable QA files score 10.0; the Ruby project generator has no scorable code
  and no findings. Codacy's sole audit warning is the credential-free loopback
  Metro status request, not remote unencrypted traffic; redirects are rejected.
  No UI copy or analytics changes. ADR 0199 records the additive native QA lane.

## Native Git scale and rapid-edit safety

- Added an opt-in 6,000-file generated fixture (~24 MB of content) to the native
  Git harness. It never copies user notes or contacts a user's remote repository.
- Before optimization, the standalone debug run passed correctness but took
  90,863 / 154,789 ms for its two clones, 117,549 ms for push, and 108,908 ms
  for pull (473,850 ms total). This is not acceptable as a launch performance target.
- A Hermes CPU profile showed JavaScript hashing and garbage collection. Expo
  Crypto now provides native digest support without replacing existing crypto
  APIs. A library-owned cache is scoped to each sync, rather than repeatedly
  reading immutable packs. The read-budget regression failed at three reads and
  now passes at one.
- A separate deterministic regression caught equal-length edits being omitted
  from checkpoints when timestamps did not advance. Checkpoints now explicitly
  stage file content before inspecting the matrix. This prioritizes correctness
  over the library's metadata shortcut; large-vault costs must include that work.
- The standalone app was rebuilt with Expo Crypto. The small native round trip
  and all six native file-access checks pass (1,516 ms for the Git fixture).
- Follow-up: clone 64,398 / 98,890 ms; push 116,589 ms; pull 122,913 ms;
  total 404,585 ms. All content/binary/deletion checks pass. Cloning improved,
  but sync is still around two minutes and **remains a launch blocker**. A second
  profile points to filesystem info calls and URI/object construction. The native
  digest's known SHA-1 vector was also verified directly on Hermes.
- These are individual debug-simulator runs, with sampled profiling, not release
  device latency guarantees. Do not claim light-speed sync from these results.
- New/touched scorable files are 10.0; the native initializer has no scorable code
  and no findings. Final scoped Codacy reports two reviewed QA warnings: the
  development-only, loopback-validated proof callback, and SHA-1 on a fixed empty
  input to verify Git's required digest. Neither is used to hash credentials or
  accept arbitrary remote destinations; no rule was suppressed. The rapid-edit
  fix has zero findings. No UI copy
  changed; no product analytics event is appropriate for internal performance
  and data-safety fixes. ADR 0200 documents the dependency and cache lifetime.

## Remaining integration limits

- This branch has not been rebased onto the October `main` tip. The recovered
  mobile baseline is August; reconcile shared desktop contracts in a separate
  verified integration batch before promotion. The inspected desktop color-token
  diff adds editor selection colors, not a wholesale palette change.
- Desktop-derived mobile constants have parity checks, but are still mirrored
  definitions rather than a single generated cross-platform design-token source.
- GitHub authenticated login needs a configured public OAuth client ID and live
  verification. Public cloning and local-server authenticated-independent Git
  transport proofs are not a substitute for testing a user's private repository.
- Linked original folders need picker/refresh/conflict integration and real
  provider QA. The current standalone picker intentionally remains copy import.
