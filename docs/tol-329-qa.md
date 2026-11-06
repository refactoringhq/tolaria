# TOL-329 Mobile Spacing Fix — QA Instructions

## Issue
Mobile Alpha: styling and spacing missing app-wide in lists and sidebar (iPhone screenshots in Linear Resources).

## Root Cause
TOL-315 commit `fe9b657c` (Nov 4) introduced dynamic Pressable style functions in `MobileListRow.tsx` and `MobileWorkspaceSidebarItem.internal.tsx`. These functions failed to apply base padding styles in certain React Native/bundler contexts.

## Fix Applied
Reverted to static style references:
- `apps/mobile/src/ui/MobileListRow.tsx`: removed dynamic `style={({ pressed }) => [...]}` 
- `apps/mobile/src/components/workspace/MobileWorkspaceSidebarItem.internal.tsx`: removed dynamic pressed state handler
- Both now use static style array references that reliably apply padding

**Commit SHA:** `777277f4` on branch `cursor/tol-329-mobile-spacing-fix-96d7`

## Linux Verification (Complete ✓)
```bash
cd /agent/repos/tolaria
git checkout cursor/tol-329-mobile-spacing-fix-96d7  # SHA: 777277f4
pnpm install --frozen-lockfile
pnpm mobile:typecheck  # ✓ passes
pnpm mobile:lint       # ✓ passes
pnpm mobile:test --run # ✓ 451 test files, 2741 tests passed
```

## Native QA on Mac (Required)

### Prerequisites
- Xcode with iOS Simulator
- Node.js + pnpm (repo toolchain)
- Git checkout at `777277f4`

### Setup
```bash
cd ~/code/tolaria  # or your local repo path
git fetch origin
git checkout cursor/tol-329-mobile-spacing-fix-96d7
pnpm install
```

### Method 1: Automated Layout Metrics (Recommended)
Uses fixture data (no vault needed), captures native metrics automatically:

```bash
# Start Metro bundler in separate terminal:
pnpm --filter @tolaria/mobile start
# Keep this running

# In another terminal, run layout probe for phone states:
pnpm mobile:qa:ios-phone-layout:list
pnpm mobile:qa:ios-phone-layout:sidebar
```

This opens `exp://127.0.0.1:8081/--/?layoutProbe=1&phoneState=<list|sidebar>` in iOS Simulator and verifies padding metrics programmatically. Script expects padding values > 10px for list items and sidebar items.

**Expected Result:** Scripts pass, confirming restored spacing.

### Method 2: Manual Visual Verification
For Alpha channel installed app (NOT dev build):

1. **Ensure Alpha channel selected**: Settings → Advanced → Update Channel → Alpha
2. **Update to latest Alpha OTA** (contains this fix once merged to main)
3. **Open a test vault** (demo-vault-v2 works if available locally)
4. **Visual check**:
   - Note list (Inbox): each item has visible top/bottom/side padding
   - Sidebar: workspace/folder items have visible spacing between them
   - Compare to "before" screenshots in Linear Resources

### What NOT to Use
- ❌ `tolaria://mobile-ui-lab?layoutProbe=1` — requires registered custom URL scheme (not present in dev builds)
- ❌ Dev build with `EXUpdatesEnabled=false` and no Metro — can't load fixture without bundler
- ❌ `--tolaria-mobile-search` flag — undocumented/unsupported

## Test Coverage Status
**Structural unit tests:** All 2741 existing tests pass. React Native Testing Library tests verify component prop trees and calculated style objects, but cannot reproduce native iOS UIKit layout engine style flattening bugs. No regression test added for this specific dynamic-vs-static style issue because:
- Structural VDOM tests cannot detect native rendering failures
- Mock render environment applies styles differently than native runtime
- False confidence from passing structural test would be misleading

**Native verification:** Required through Method 1 (automated metrics) or Method 2 (manual visual QA) above.

## Privacy
Luca's screenshots contain private vault content. Never commit, leak titles/content, or upload to public PRs/GitHub/CI.

## PR Status
- **Branch:** `cursor/tol-329-mobile-spacing-fix-96d7`
- **PR:** https://github.com/refactoringhq/tolaria/pull/1320
- **CI:** In progress
- **Linear:** TOL-329 remains In Progress (Karn/cloud exclusive ownership)
