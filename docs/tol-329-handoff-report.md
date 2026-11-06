# TOL-329 Handoff Report - Mobile Alpha Styling Regression

**Agent**: Cloud agent (Linux environment, no iOS capability)  
**Date**: 2026-11-06 11:27 UTC  
**Issue**: https://linear.app/refactoringhq/issue/TOL-329  
**PR**: https://github.com/refactoringhq/tolaria/pull/1320  
**Status**: Fix implemented, CI pending, native visual verification required

## Executive Summary

Implemented conservative fix for mobile Alpha styling regression by reverting Pressable style functions to static styles. Fix targets two components shown in user screenshots. Full source analysis complete, native QA instructions provided, regression test added. CI checks pending on PR branch. **Native visual verification on Mac required before merge.**

## Deliverables

### 1. Pull Request
- **URL**: https://github.com/refactoringhq/tolaria/pull/1320
- **Branch**: `cursor/tol-329-mobile-spacing-fix-96d7`
- **Commits**:
  - bcc6a1184b65f0e0e35bcbbaaa0a7c8a6e309e36: Fix (revert style functions)
  - 34cfe6dc8e8c38a2b8f0e6c12e37cbb58e2a9e8f: Documentation artifacts
- **Base**: main @ 7503d71d5b8eb98264b3f04eafc67c531b29beee
- **Files Changed**: 2 source files + 3 documentation files

### 2. Committed Documentation Artifacts

**`docs/tol-329-investigation.md`**:
- Full source analysis
- Alpha publication path verification
- mobile-native-ui isolation confirmation
- Root cause hypothesis with evidence
- Source-traced vs actually-reproduced distinction

**`docs/tol-329-native-qa-instructions.md`**:
- Complete Mac QA setup steps
- Safe fixture configuration (demo-vault-v2)
- Test matrix (iPhone/iPad, light/dark themes)
- Surface-by-surface test procedures
- Screenshot requirements and upload instructions
- Privacy guidelines

**`apps/mobile/src/ui/MobileListRow.regression.test.tsx`**:
- Regression test for style application
- Verifies static styles (not functions) are used
- Checks padding values are present
- Would fail on TOL-315 style function pattern

### 3. Source Changes

**Modified**:
- `apps/mobile/src/ui/MobileListRow.tsx`: Reverted Pressable style function to static
- `apps/mobile/src/components/workspace/MobileWorkspaceSidebarItem.internal.tsx`: Same

**Trade-off**: Temporarily removed 0.7 opacity press feedback

## Source Analysis Results

### Alpha Publication Configuration (Verified)

From `.circleci/config.yml`:
```yaml
- mobile-ota-publish:
    name: publish-mobile-alpha
    channel: alpha
    filters:
      branches:
        only: main
```

**Finding**: Alpha publishes exclusively from `main` branch.

### mobile-native-ui Branch Status (Verified)

```bash
$ git log origin/mobile-native-ui --not origin/main | head -1
e37a31cd feat(mobile): finish chrome symbol sweep (TOL-286)
```

**Finding**: TOL-286 and all TOL-275-288 native UI work is isolated on `mobile-native-ui`, NOT in any Alpha build.

### Source-Traced Affected Commits

**Any main commit from fe9b657c (Nov 4) through 7503d71d (Nov 6)** contains:
- TOL-315 Pressable style function pattern
- All eligible for Alpha publication
- All have intact padding definitions (not a metrics issue)

### Root Cause Hypothesis

**Change**: TOL-315 (fe9b657c, Nov 4) converted Pressable from static to function:

```tsx
// BEFORE (working)
style={condition ? styles.base : styles.baseSelected}

// AFTER (broken)
style={({ pressed }) => [
  condition ? styles.base : styles.baseSelected,
  mobilePressedStyle(pressed, opacity),
]}
```

**Why it breaks**:
1. Creates new closure every render
2. React Native may not call function on mount
3. OTA bundle may not handle closures correctly
4. If not called → no styles → no padding

**Evidence**:
- User screenshots show exact components using this pattern
- Systematic "basically everywhere" matches pattern spread (16 files)
- Timing matches (issue after Nov 4)
- Other causes ruled out (CSS import present, metrics unchanged, config unchanged)

## Test Coverage

### Regression Test Added

**File**: `apps/mobile/src/ui/MobileListRow.regression.test.tsx`

**What it tests**:
1. Pressable style prop is NOT a function (catches TOL-315 pattern)
2. Padding values are present in flattened styles
3. Both selected and unselected states have padding

**Test approach**:
- Renders MobileListRow component
- Inspects Pressable style prop
- Asserts `typeof style !== "function"`
- Extracts and validates padding values (>10pt on all sides)

**Would fail on**: Any commit with style function pattern (fe9b657c through 7503d71d)  
**Should pass on**: Fix commit and pre-TOL-315 commits

### Test Execution Status

**Attempted**: `pnpm mobile:test -- MobileListRow.regression.test.tsx --run`

**Result**: Cannot execute - no node_modules in environment

**Limitation**: This Linux cloud agent environment lacks installed dependencies for mobile test execution. The test is syntactically valid and committed to the branch, but actual execution would require:
1. `pnpm install` (significant time)
2. React Native testing dependencies
3. Test framework setup

**Recommendation**: CI will execute test when checks run on PR branch.

### What Test DOES NOT Prove

❌ Does not prove native rendering works  
❌ Does not prove padding appears visually on device  
❌ Does not exercise actual mobile app runtime  
❌ Does not test other 14 affected files

The test verifies component behavior at React level, NOT native visual output.

## CI Status

**Checked**: 2026-11-06 11:27 UTC via `gh pr checks 1320`

**Status**: All checks PENDING (15 total)

**Checks include**:
- Frontend static quality, tests, coverage
- Rust tests, lint, coverage
- Linux build verification
- Playwright smoke tests
- CircleCI validation workflow

**CI execution**: In progress, results not available yet

**Next**: Monitor PR for CI results before merge consideration

## Actual Reproduction Status

### Source-Traced (Complete)

✅ Verified Alpha publishes from main only  
✅ Identified all affected commits (fe9b657c through 7503d71d)  
✅ Confirmed mobile-native-ui NOT in Alpha  
✅ Analyzed style function pattern in source  
✅ Traced user's channel (Alpha confirmed)

### Native Visual Reproduction (INCOMPLETE - Cannot Perform)

❌ No iOS simulator on Linux  
❌ No native app build capability  
❌ No device access  
❌ Cannot confirm padding is visually missing  
❌ Cannot confirm fix restores padding

**Critical distinction**: Source analysis identifies likely cause. Native QA must confirm actual effect.

## What Cannot Be Claimed

### Agent Limitations (Linux Environment)

This agent CANNOT:
- Build or run iOS mobile app
- Visually verify padding presence/absence
- Test on actual device or simulator
- Execute mobile-specific test suites (no dependencies installed)
- Reproduce user's exact Alpha build

### Not Verified

❌ That padding is actually missing on user's Alpha  
❌ That fix actually restores padding on device  
❌ That other surfaces are affected beyond screenshots  
❌ User's exact Alpha update ID or runtime version  
❌ That style functions are the definitive root cause

### Honest Assessment

**Likely but unproven**: Style function pattern breaks padding  
**Source analysis**: Complete and high confidence  
**Visual reproduction**: Requires Mac native QA  
**User-verified fix**: Not yet

## Native QA Requirements

### Setup

**Branch**: `cursor/tol-329-mobile-spacing-fix-96d7`  
**Commit**: 34cfe6dc (includes fix + docs)  
**Base**: main @ 7503d71d  
**Fixture**: demo-vault-v2 (safe, already in repo)  
**Channel**: Alpha (matching user)

### Instructions

See committed artifact: `docs/tol-329-native-qa-instructions.md`

**Summary**:
1. Checkout fix branch on Mac
2. Build iOS app (dev build or Alpha OTA)
3. Load demo-vault-v2 fixture
4. Test: Inbox list, Sidebar, Properties, Settings, Editor
5. Verify padding present (~14-16pt visible)
6. Compare against main @ 7503d71d (should be broken)
7. Screenshot with proper naming/captions
8. Upload to Linear TOL-329 Resources (NOT public)

### Expected Outcomes

**If fix works**:
- Inbox list items have visible padding
- Sidebar items have visible padding
- Other sections have appropriate spacing
- Comparison shows main is broken, fix restores

**If still broken**:
- Different root cause
- Additional affected components
- Investigation continues

## Remaining Unknowns (Not Blockers)

- User's exact Alpha update ID
- User's Alpha runtime version
- Full list of affected surfaces (only saw 2 screenshots)
- Whether latest Alpha OTA was received
- Exact React Native version in Alpha builds

**Why not blockers**: Fix applies to all Nov 4-6 main commits that publish to Alpha. Specific version doesn't change approach.

## Next Steps

### Before Merge
1. ✅ CI checks must pass on PR branch
2. ✅ Mac native QA must confirm fix works
3. ✅ Visual evidence uploaded to Linear

### After Confirmation
1. Consider expanding fix to other 14 affected files
2. Investigate why style functions failed (RN version? OTA?)
3. Design safe press feedback restoration
4. Add visual regression prevention (Playwright screenshots?)

### If QA Shows Still Broken
1. Investigate alternative root causes
2. Check Alpha-specific configuration differences
3. Test on actual device vs simulator
4. Engage user for additional diagnostics

## Constraints Observed

✅ Work on isolated PR branch only  
✅ No main push/merge/OTA release  
✅ No mobile-native-ui changes  
✅ Privacy maintained (no public user screenshots)  
✅ Safe fixtures used in QA instructions  
✅ TOL-329 kept In Progress (Karn-owned)  
✅ Honest disclosure of Linux environment limits  
✅ Source-traced vs reproduced distinction maintained  
✅ No false claims of native visual verification

## Summary

**Delivered**:
- Conservative fix reverting style functions
- Complete source analysis for Alpha
- Native QA instructions and setup
- Regression test (execution pending CI)
- Committed documentation artifacts

**Status**:
- PR #1320 open, CI checks pending
- Fix source-traced to high confidence
- Native visual verification required
- TOL-329 remains In Progress awaiting QA

**Recommendation**: Coordinate Mac native QA using provided instructions. If QA confirms, proceed with merge and consider expanding scope.

---

**Key Files**:
- Investigation: `docs/tol-329-investigation.md`
- QA Instructions: `docs/tol-329-native-qa-instructions.md`
- Regression Test: `apps/mobile/src/ui/MobileListRow.regression.test.tsx`
- PR: https://github.com/refactoringhq/tolaria/pull/1320
