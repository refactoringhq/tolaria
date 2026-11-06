# TOL-329 Mobile Spacing Fix — Pre-Merge Native QA Blocked

## Issue
Mobile Alpha: styling and spacing missing app-wide in lists and sidebar (iPhone screenshots in Linear Resources).

## Root Cause
TOL-315 commit `fe9b657c` (Nov 4) introduced dynamic Pressable style functions in `MobileListRow.tsx` and `MobileWorkspaceSidebarItem.internal.tsx`. These functions failed to apply base padding styles in certain React Native/bundler contexts.

## Fix Applied
Reverted to static style references in both components.

**Branch:** `cursor/tol-329-mobile-spacing-fix-96d7`  
**Tested SHA:** `31e35010`

## Linux Verification — All Gates Passed ✓

```bash
cd /agent/repos/tolaria
git checkout cursor/tol-329-mobile-spacing-fix-96d7  # SHA: 31e35010
pnpm install --frozen-lockfile

# All commands run with preserved exit codes:
pnpm mobile:typecheck  # EXIT_CODE=0
pnpm mobile:lint       # EXIT_CODE=0
pnpm mobile:test --run # EXIT_CODE=0
```

**Test results:**
```
Test Files  451 passed (451)
Tests  2741 passed (2741)
Duration  53.97s (transform 6.29s, setup 0ms, import 76.02s, tests 26.75s, environment 18.55s)
```

**Limitations:** Structural React Native Testing Library tests verify VDOM prop trees and calculated style objects. Cannot reproduce native iOS UIKit layout engine style flattening bugs. No regression test added.

## Native QA Status — Pre-Merge Blocked by Architecture

### Mac Worker Setup (Confirmed)
- Worktree: `/Volumes/Jupiter/Workspace/tolaria-worktrees/tol329-native-qa @ 777277f4`
- Metro: PID 48774, port 8083, localhost listening
- Binary: `com.tolaria.mobile.dev 0.2.0(1)`
- URL schemes: `tolaria://`, `com.tolaria.mobile.dev://` registered
- Correct dev-client URL: `tolaria://expo-development-client/?url=http%3A%2F%2Flocalhost%3A8083%2F...`

### Attempted Result
Launched dev-client URL with `source=fixture&layoutProbe=1&phoneState=list` params → `MobileWorkspaceLoadFailure` error UI displayed.

### Architectural Blocker (Source-Backed)

**File:** `apps/mobile/App.tsx:31`
```tsx
<MobileVaultProvider><MobileUiLab /></MobileVaultProvider>
```

**File:** `apps/mobile/src/workspace/MobileVaultProvider.tsx:16,19,34-37`
```tsx
const manager = useMobileVaults()  // line 16: native Git vault catalog manager
const recovery = workspaceRecovery(manager)  // line 19: derives recovery state

{recovery?.reason ?   // line 34: if recovery reason exists
  <MobileWorkspaceLoadFailure onManage={open} onRetry={recovery.retry} reason={recovery.reason} /> :
  <MobileWorkspaceStartup ...>{children}</MobileWorkspaceStartup>
}
```

**Blocking logic:**
1. Production app wraps `<MobileUiLab />` in `<MobileVaultProvider />`
2. Provider calls `useMobileVaults()` — manages native Git vault catalog/persistence state
3. If `recovery?.reason` is truthy (catalog error, failed vault restore, etc.), provider renders error UI
4. When error UI shown, `children` (`<MobileUiLab />`) never mounts
5. `MobileUiLab` reads `source=fixture` to use synthetic data, but it's inside provider wrapper
6. Provider blocks mounting based on native vault manager state regardless of `source=fixture` param

**Why XCUITest works:** `apps/mobile/native-ui-tests/*.swift` (100+ files) use `--tolaria-mobile-search` launch argument in controlled fresh-install test lifecycle with clean simulator state and no persisted vault catalog errors.

## Options for Pre-Merge Native Verification

**Option 1 — Test harness change (requires parent approval):**
- Conditionally skip `MobileVaultProvider` wrapper when `source=fixture` param present
- Scope: `apps/mobile/App.tsx` modifications (~5-10 lines), possibly new fixture shell component
- Risk: Non-production code path; must be clearly isolated/feature-flagged

**Option 2 — Post-merge Alpha verification:**
- Merge to `main` → Alpha OTA publishes → verify on installed Alpha channel app
- Native spacing verification happens post-merge only

**Option 3 — Accept limitation:**
- Rely on Linux gates (passed) + post-merge Alpha verification
- Document that pre-merge native QA architecturally blocked by provider design

## Current Status

**Runtime fix:** Complete (2 components, static style revert)  
**Linux gates:** ✓ All passed (exit code 0: typecheck, lint, 451 test files/2741 tests)  
**Native QA:** Blocked pre-merge by `MobileVaultProvider` architecture  
**Tested SHA:** `31e35010`  
**PR:** https://github.com/refactoringhq/tolaria/pull/1320  
**Linear:** TOL-329 In Progress

**No spacing verification from structural tests.** Native spacing can only be verified through:
1. Option 1 test harness (if approved) on Mac worker's isolated setup
2. Option 2 post-merge on installed Alpha channel app  
3. Option 3 post-merge production verification

**Awaiting parent decision on verification approach.**
