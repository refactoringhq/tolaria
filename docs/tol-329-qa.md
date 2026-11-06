# TOL-329 Mobile Spacing Fix — Native QA Blocked by Provider Architecture

## Issue
Mobile Alpha: styling and spacing missing app-wide in lists and sidebar (iPhone screenshots in Linear Resources).

## Root Cause
TOL-315 commit `fe9b657c` (Nov 4) introduced dynamic Pressable style functions in `MobileListRow.tsx` and `MobileWorkspaceSidebarItem.internal.tsx`. These functions failed to apply base padding styles in certain React Native/bundler contexts.

## Fix Applied
Reverted to static style references in both components.

**Commit SHA:** `58fee532` on branch `cursor/tol-329-mobile-spacing-fix-96d7`

## Linux Verification (Complete ✓)

```bash
cd /agent/repos/tolaria
git checkout cursor/tol-329-mobile-spacing-fix-96d7  # SHA: 58fee532
pnpm install --frozen-lockfile
pnpm mobile:typecheck  # ✓ passes
pnpm mobile:lint       # ✓ passes
pnpm mobile:test --run # ✓ 451 test files, 2741 tests passed, 52.94s
```

**Test output confirmed:**
```
Test Files  451 passed (451)
Tests  2741 passed (2741)
Duration  52.94s
```

## Native QA Status: Blocked by Architecture Limitation

### Mac Setup (Verified)
- Isolated worktree: `/Volumes/Jupiter/Workspace/tolaria-worktrees/tol329-native-qa`
- Commit: `777277f4` (runtime fix HEAD before doc updates)
- Metro: PID 48774, port 8083, localhost/[::1] listening
- Dev binary: `com.tolaria.mobile.dev 0.2.0(1)`
- URL schemes registered: `tolaria://`, `com.tolaria.mobile.dev://`
- Expo dev-client URL: `tolaria://expo-development-client/?url=http%3A%2F%2Flocalhost%3A8083`

### Attempted Launch
```
tolaria://expo-development-client/?url=http%3A%2F%2Flocalhost%3A8083%2F--%2F%3Fsource%3Dfixture%26layoutProbe%3D1%26phoneState%3Dlist
```

**Result:** `MobileWorkspaceLoadFailure` error UI (screenshot: /home/ubuntu/.cursor/projects/agent-repos-tolaria/assets/before-list-fixture-0cc5cda52.png)

### Root Cause Analysis (Source-Backed)

**File:** `apps/mobile/App.tsx:31`
```tsx
<MobileVaultProvider><MobileUiLab /></MobileVaultProvider>
```

**File:** `apps/mobile/src/workspace/MobileVaultProvider.tsx:34-37`
```tsx
{recovery?.reason ? <MobileWorkspaceLoadFailure onManage={open} onRetry={recovery.retry} reason={recovery.reason} /> :
  <MobileWorkspaceStartup preview={manager.catalog.preview} pending={restorePending} hasActiveWorkspace={Boolean(active.selection)}
    onSelectNote={manager.catalog.selectPreviewNote}>
    {children}
  </MobileWorkspaceStartup>}
```

**Blocking logic:**
1. `MobileVaultProvider` (line 16) calls `useMobileVaults()` — manages native Git vault catalog/state
2. Line 19: `const recovery = workspaceRecovery(manager)` derives recovery state
3. Line 34: If `recovery?.reason` is truthy, renders `MobileWorkspaceLoadFailure` and `children` (`<MobileUiLab />`) never mounts
4. `MobileUiLab` reads `source=fixture` param to use synthetic data (line 120: `workspaceSource` → `readOnlyWorkspaceRepository`)
5. BUT `MobileUiLab` is wrapped inside `MobileVaultProvider` which can prevent mounting based on native vault manager state

**Architectural constraint:** Production app architecture requires `MobileVaultProvider` wrapper for native vault management. QA fixture mode (`source=fixture`) bypasses vault data but not the provider wrapper. If native vault manager has recovery state (catalog error, failed vault restore, etc.), provider shows error UI regardless of `source=fixture` param.

### Why Native UI Tests Work

**File:** `apps/mobile/src/native/mobileNativeKeyCommandsContract.ts:24`
```ts
export const mobileLaunchSearchArgumentName = '--tolaria-mobile-search'
```

**Usage:** `apps/mobile/native-ui-tests/*.swift` (100+ XCUITest files)
```swift
app.launchArguments = ["--tolaria-mobile-search", "?source=fixture&layoutProbe=1&qaRun=..."]
```

XCUITest launches bypass provider issues through controlled app lifecycle (fresh install, clean simulator state, no persisted vault catalog errors).

### Minimal Test Harness Change Proposal

To verify spacing fix without altering production runtime behavior, one option:

**Scope:** Add fixture-only entry point that conditionally skips `MobileVaultProvider` when `source=fixture` param present
**Files:** `apps/mobile/App.tsx` (5-10 lines), possibly new `apps/mobile/src/screens/MobileUiLabFixtureShell.tsx`
**Risk:** Adds non-production code path; must be feature-flagged/clearly isolated
**Alternative:** Await Alpha OTA merge for post-merge visual verification on installed app

**This proposal requires parent approval before implementation.** Not proceeding with runtime/harness changes beyond authorized two-component fix.

## Current Status

**Fix:** Complete, tested on Linux
**PR:** https://github.com/refactoringhq/tolaria/pull/1320
**CI:** Checks queued
**Native QA:** Blocked by provider architecture (source-documented above)
**Linear TOL-329:** In Progress (Karn/cloud exclusive ownership)

**Options:**
1. Parent approves minimal fixture-shell test harness (scope/files/risks above)
2. Merge to main, verify on installed Alpha channel app (post-merge only)
3. Accept structural limitation, rely on Linux gates + production Alpha verification

No main merge/push/OTA/release/Apple changes without explicit approval.
