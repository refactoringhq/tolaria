# TOL-329 Investigation Report - Mobile Alpha Styling Regression

**Date**: 2026-11-06  
**Agent**: Cloud agent (Linux environment, no native iOS capability)  
**Issue**: https://linear.app/refactoringhq/issue/TOL-329  
**Status**: Fix implemented on PR branch, native visual verification required

## User Evidence

- **Channel**: Mobile Alpha (user confirmed 12:23 Rome time)
- **Device**: iPhone (from screenshots)
- **Symptoms**: "styling and spacing missing basically everywhere"
- **Screenshots**: 2 images attached to Linear TOL-329 as Resources:
  - f05b4127-0aa2-4ae9-b0f6-68a927bcb22d: Inbox note list
  - 3ef1e671-2150-4819-9575-5d3980e7ed1c: Sidebar
- **Privacy**: Original screenshots contain user's private vault content, viewed for diagnosis only, not committed or made public

## Alpha Source Tracing

### Alpha Publication Configuration

From `.circleci/config.yml`:
```yaml
- mobile-ota-publish:
    name: publish-mobile-alpha
    channel: alpha
    filters:
      branches:
        only: main  # Alpha publishes from main ONLY
```

**Key fact**: Mobile Alpha OTA updates publish exclusively from `main` branch after validation gates pass.

### mobile-native-ui Branch Status (NOT in Alpha)

Verified with:
```bash
$ git log origin/mobile-native-ui --not origin/main | head -5
e37a31cd feat(mobile): finish chrome symbol sweep (TOL-286)
aee997f9 feat(mobile): checkpoint fixed chrome symbol sweep (TOL-286)
4bec95d4 feat(TOL-287): native chrome colors, notices, and haptics
c82445e3 merge: integrate main into mobile-native-ui
3eff22b1 fix(TOL-285): make glass menu triggers tappable
```

**TOL-286 (e37a31cd) and all TOL-275-288 native UI work is on isolated branch `mobile-native-ui`, NOT merged to main, therefore NOT in any Alpha build.**

### Commits in Main (Published to Alpha)

Nov 4-6, 2026 main commits (all eligible for Alpha publication):

```
7503d71d fix: continue sheet pointer selection after stale model (TOL-327)
b09846d6 fix: mute bash comments after commands (TOL-326)
12ecd83e docs: record TOL-75 sync scan release evidence
33c6d8b6 fix: avoid duplicate clean scan during sync (TOL-75)
c8b941f3 feat: finish native mobile conventions (TOL-316)
0aaf1446 feat: match panel settle to swipe velocity (TOL-316)
73978655 fix: animate mobile toolbar with keyboard (TOL-316)
dbd57502 fix: dismiss mobile search keyboard on drag (TOL-316)
35960f2b fix: refresh active mobile vault slug (TOL-319)
68e3244a fix: respect custom SSH commands for Git sync (TOL-324)
00924f4e refactor(TOL-315): split list render paths for Lizard
fe9b657c feat(TOL-315): add mobile list touch feedback and stable selection  <-- SUSPECT
```

## Root Cause Analysis

### Suspected Change: TOL-315 Style Function Pattern

**Commit**: fe9b657c  
**Date**: Nov 4, 2026  
**Author**: lucaronin  
**Title**: "feat(TOL-315): add mobile list touch feedback and stable selection"

This commit changed Pressable components from static style selection to dynamic style functions:

**BEFORE TOL-315** (stable, commit fe9b657c^):
```tsx
<Pressable
  onPress={props.onPress}
  style={rowState.desktopSelected ? styles.baseSelected : styles.base}
>
```

**AFTER TOL-315** (fe9b657c through current main):
```tsx
<Pressable
  onPress={props.onPress}
  style={({ pressed }) => [
    rowState.desktopSelected ? styles.baseSelected : styles.base,
    mobilePressedStyle(pressed, desktopToolbarActionParity.pressedOpacity),
  ]}
>
```

### Why This Could Break Padding

1. **Function creates new closure every render**: Captures `rowState`, `styles` and other variables from component scope
2. **React Native Pressable contract**: Should call style function with `{ pressed: false }` on mount
3. **Potential compatibility issue**: Some RN versions or build configurations may not invoke the function correctly
4. **OTA bundle processing**: Dynamic functions with closures may not serialize/transmit correctly in over-the-air updates
5. **If function not called**: Pressable has no style object → no padding applied

### Evidence Supporting This Hypothesis

- **User screenshots show exact affected components**: MobileListRow (Inbox), MobileWorkspaceSidebarItem (Sidebar)
- **Systematic nature**: "basically everywhere" suggests pattern-wide issue
- **Timing**: Issue appeared after TOL-315 landed (Nov 4)
- **Pattern spread**: 16 files adopted this style function pattern in TOL-315/TOL-316
- **Not other causes**:
  - CSS import present: `apps/mobile/App.tsx` line 1: `import './global.css'`
  - Tailwind config unchanged
  - Metro/babel config unchanged
  - Metrics properly defined: `desktopNoteItemParity.padding = {bottom: 14, left: 16, right: 16, top: 14}`

### Files Using Style Function Pattern

From grep of `style={({ pressed }) =>`:
- apps/mobile/src/ui/MobileListRow.tsx ✓ (shown in screenshot)
- apps/mobile/src/components/workspace/MobileWorkspaceSidebarItem.internal.tsx ✓ (shown in screenshot)
- apps/mobile/src/components/workspace/MobileWorkspaceSidebarFolderTree.tsx
- apps/mobile/src/components/workspace/MobileQuickOpenSheet.tsx
- apps/mobile/src/components/workspace/MobileRelationshipRows.tsx
- apps/mobile/src/components/workspace/MobileSourceBlockMoreActions.tsx
- apps/mobile/src/components/workspace/MobileTableAlignmentControls.tsx
- apps/mobile/src/components/workspace/MobileTableMoreActions.tsx
- apps/mobile/src/components/workspace/MobileTableOfContentsSheet.tsx
- apps/mobile/src/components/workspace/MobileTypeSectionEditor.tsx
- apps/mobile/src/components/workspace/MobileWhiteboardMoreActions.tsx
- apps/mobile/src/components/workspace/MobileWorkspaceActionSheet.tsx
- apps/mobile/src/components/workspace/MobileWorkspaceSheetChrome.tsx
- apps/mobile/src/components/workspace/MobileEditorFindSheet.tsx
- apps/mobile/src/components/workspace/MobileMarkdownSourceEditor.tsx
- apps/mobile/src/components/workspace/MobileNoteListBulkActionBar.tsx

## Source-Traced vs Actually Reproduced

### Source-Traced (High Confidence)

**Any main commit from fe9b657c through 7503d71d** contains the style function pattern and publishes to Alpha.

**Source analysis establishes**:
- ✅ TOL-315 introduced pattern on Nov 4
- ✅ Pattern exists in all main commits Nov 4-6
- ✅ These commits publish to Alpha channel
- ✅ mobile-native-ui branch NOT in Alpha
- ✅ Style definitions and metrics unchanged

### NOT Actually Reproduced (Linux Environment)

**Agent limitations**:
- ❌ No iOS simulator
- ❌ No native mobile app build capability
- ❌ No device access
- ❌ Cannot visually confirm padding is missing
- ❌ Cannot verify fix restores padding

**Source tracing is NOT visual reproduction**. Native visual verification required.

## Fix Implementation

### PR Details

- **Pull Request**: #1320
- **Branch**: `cursor/tol-329-mobile-spacing-fix-96d7`
- **Base**: main @ 7503d71d5b8eb98264b3f04eafc67c531b29beee
- **Fix commit**: bcc6a1184b65f0e0e35bcbbaaa0a7c8a6e309e36

### Changes Made

Reverted Pressable style functions to static styles in 2 files shown in user screenshots:

**File 1**: `apps/mobile/src/ui/MobileListRow.tsx`
```diff
-import { desktopToolbarActionParity } from "./desktopParity";
-import { mobilePressedStyle } from "./mobilePressFeedback";

-    style={({ pressed }) => [
-      rowState.desktopSelected ? styles.baseSelected : styles.base,
-      mobilePressedStyle(pressed, desktopToolbarActionParity.pressedOpacity),
-    ]}
+    style={rowState.desktopSelected ? styles.baseSelected : styles.base}
```

**File 2**: `apps/mobile/src/components/workspace/MobileWorkspaceSidebarItem.internal.tsx`
```diff
-import { mobilePressedStyle } from "../../ui/mobilePressFeedback";

-    style={({ pressed }) => [
-      styles.item,
-      sidebarItemPadding(themeStyles.metrics.sidebar, Boolean(count)),
-      active ? { backgroundColor: activeBackgroundColor } : null,
-      mobilePressedStyle(pressed, themeStyles.metrics.toolbarAction.pressedOpacity),
-    ]}
+    style={[
+      styles.item,
+      sidebarItemPadding(themeStyles.metrics.sidebar, Boolean(count)),
+      active ? { backgroundColor: activeBackgroundColor } : null,
+    ]}
```

### Trade-offs

- **Lost feature**: Press feedback (0.7 opacity on tap)
- **Gained**: Reliable static style application
- **Preserved**: Component refactoring, padding values, all other behavior

### Conservative Scope

Only fixed 2 files shown in screenshots. Other 14 affected files can follow if QA confirms fix works.

## Refs Summary

| Ref | Style Pattern | Alpha Status | Native Verified |
|-----|---------------|--------------|-----------------|
| main @ fe9b657c^ | Static (old) | Published | NO (Linux agent) |
| main @ fe9b657c | Function (new) | Published | NO (Linux agent) |
| main @ 7503d71d | Function (new) | Published | NO (Linux agent) |
| cursor/tol-329-mobile-spacing-fix-96d7 @ bcc6a118 | Static (reverted) | Not published | NO (Linux agent) |

**Conclusion**: Source analysis complete, native visual reproduction pending Mac lane QA.
