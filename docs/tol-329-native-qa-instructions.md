# TOL-329 Native QA Instructions - Alpha Channel Testing

**Issue**: https://linear.app/refactoringhq/issue/TOL-329  
**PR**: https://github.com/refactoringhq/tolaria/pull/1320  
**Branch**: `cursor/tol-329-mobile-spacing-fix-96d7`  
**Commit**: bcc6a1184b65f0e0e35bcbbaaa0a7c8a6e309e36  
**Base**: main @ 7503d71d5b8eb98264b3f04eafc67c531b29beee

## Prerequisites

- Mac with Xcode and iOS Simulator OR physical iPhone
- Repository checked out
- Alpha channel configuration (user is on Alpha)

## Setup Instructions

### 1. Checkout Fix Branch

```bash
cd /path/to/tolaria
git fetch origin
git checkout cursor/tol-329-mobile-spacing-fix-96d7
git log -1 --oneline  # Verify: bcc6a118 fix(mobile): revert Pressable style functions
```

### 2. Install Dependencies

```bash
pnpm install
```

### 3. Prepare Safe Test Fixture

**IMPORTANT**: Use demo-vault-v2, NOT user's ~/Laputa production vault.

```bash
# demo-vault-v2 is already in the repo at:
ls -la demo-vault-v2/
```

This fixture contains safe synthetic content:
- Multiple notes with titles, subtitles, metadata
- Folder structure
- Different note types
- No private user data

### 4. Build for Alpha Channel

**Option A: Dev Build (Recommended)**
```bash
cd apps/mobile
pnpm start
# In separate terminal:
pnpm ios  # Opens iOS Simulator
```

**Option B: TestFlight Alpha Build** (if coordinating actual Alpha OTA test)
- User has Alpha enabled in Settings > Updates > Alpha
- Would need actual Alpha OTA published from this branch (NOT in scope for QA)

## Test Execution

### Test Matrix

| Device | OS | Channel | Theme | Fixture |
|--------|----|---------| ------|---------|
| iPhone 15 Simulator | iOS 17.5+ | Dev from fix branch | Light | demo-vault-v2 |
| iPhone 15 Simulator | iOS 17.5+ | Dev from fix branch | Dark | demo-vault-v2 |
| iPad Simulator | iOS 17.5+ | Dev from fix branch | Light | demo-vault-v2 |
| Physical iPhone (optional) | iOS 17+ | Dev from fix branch | Light | demo-vault-v2 |

### Surface 1: Inbox Note List (Primary Evidence)

**Setup**:
1. Open app on simulator/device
2. Load demo-vault-v2 (or create throwaway vault, add sample notes)
3. Navigate to Inbox view

**What to Check**:
- [ ] List items have padding on all sides (~14-16pt visible space)
- [ ] Title text not touching edges
- [ ] Subtitle text properly spaced below title
- [ ] Footer chips/metadata have spacing
- [ ] Leading icons properly inset
- [ ] Border between items present

**Commands to Reach**:
```
1. Launch app
2. Tap "Open Vault" or continue if vault loaded
3. Default view is Inbox (note list)
```

**Screenshot**: `tol-329-after-inbox-iphone15-light.png`

**Expected**: Visible padding around each note item, matching desktop parity metrics (14-16pt).

### Surface 2: Sidebar (Secondary Evidence)

**Setup**:
1. From any view, open sidebar
2. Check both Views and Types sections

**What to Check**:
- [ ] Sidebar items have padding (~6-12pt depending on type)
- [ ] Icon and label properly spaced
- [ ] Count pills have spacing
- [ ] Items not touching edges
- [ ] Folder tree indentation correct

**Commands to Reach**:
```
1. Tap hamburger menu icon (top-left)
2. Sidebar opens with Views/Types sections
```

**Screenshot**: `tol-329-after-sidebar-iphone15-light.png`

**Expected**: Visible padding in sidebar items, proper icon/label/count layout.

### Surface 3: Other Sections (User Reported "Basically Everywhere")

Test additional surfaces that may use list components:

**Properties Panel**:
```
1. Open any note
2. Tap "Properties" button
3. Check property rows have padding
```

**Settings Sheets**:
```
1. Tap profile icon or settings
2. Navigate through settings sections
3. Check list items have padding
```

**Editor Chrome**:
```
1. Open note for editing
2. Check toolbar buttons have spacing
3. Check formatting menu has padding
```

**Screenshot**: `tol-329-after-properties-iphone15-light.png` (if affected)

### Surface 4: Comparison Test (Optional)

To verify fix effectiveness, compare against known-broken commit:

```bash
# Checkout known-broken commit
git checkout main
git log -1 --oneline  # Should be 7503d71d or later

# Rebuild and test
pnpm start
# Check same surfaces - padding should be missing
```

## Recording Evidence

### Screenshot Requirements

**Naming Convention**:
```
tol-329-after-{surface}-{device}-{channel}-{theme}.png
```

Examples:
- `tol-329-after-inbox-iphone15-alpha-light.png`
- `tol-329-after-sidebar-ipad-alpha-dark.png`
- `tol-329-after-properties-iphone15-alpha-light.png`

**Caption Format**:
```
Alpha channel after fix @ bcc6a118
Device: iPhone 15 Simulator, iOS 17.5
Fixture: demo-vault-v2
View: Inbox note list
Theme: light
```

### Upload Location

**Linear**: https://linear.app/refactoringhq/issue/TOL-329
- Attach to Resources (same section as original screenshots)
- Use Linear file upload, not external links

**Privacy**:
- ❌ DO NOT upload user's original screenshots to public GitHub/CI
- ❌ DO NOT use user's ~/Laputa vault for screenshots
- ✅ Use demo-vault-v2 safe synthetic content
- ✅ Upload only to private Linear Resources

### QA Report Format

After testing, add comment to Linear TOL-329:

```markdown
**QA Results: Fix @ bcc6a118**

**Environment**:
- Device: iPhone 15 Simulator
- OS: iOS 17.5
- Build: Dev from cursor/tol-329-mobile-spacing-fix-96d7
- Fixture: demo-vault-v2

**Surfaces Tested**:
- ✅ Inbox note list: Padding present, ~14-16pt visible on all sides
- ✅ Sidebar: Item padding present, icon/label/count properly spaced
- ✅ Properties panel: Row padding present
- ⚠️ Settings: [result]

**Comparison**:
- Tested against main @ 7503d71d (known broken): Padding missing ✓ reproduced
- Tested fix @ bcc6a118: Padding restored ✓ fixed

**Screenshots**: See attached Resources
- [list filenames]

**Recommendation**: [Ready for merge / Needs additional work / etc.]
```

## Known Limitations

### What This Fix Does NOT Address

1. **Other 14 affected files**: Only fixed MobileListRow and MobileWorkspaceSidebarItem
2. **Press feedback**: Temporarily removed 0.7 opacity on tap (can restore later)
3. **Root cause**: Did not investigate WHY style functions fail (RN version? OTA system?)

### If Padding Still Missing After Fix

Possible causes:
1. Different root cause (not style functions)
2. Additional affected components not yet fixed
3. Build/cache issue (try clean build)
4. Test environment doesn't match user's actual Alpha

Report findings to Linear TOL-329 for further investigation.

## Clean Build (If Needed)

```bash
# Clean all caches
cd apps/mobile
rm -rf node_modules
pnpm install

# Clean iOS build
cd ios
rm -rf build
xcodebuild clean
cd ..

# Restart Metro
pnpm start --reset-cache
```

## Rollback Testing (Optional)

To confirm issue exists on main:

```bash
git checkout main
git log -1 --oneline  # Verify commit with style functions

# Rebuild
cd apps/mobile
pnpm start
pnpm ios

# Test same surfaces - padding should be MISSING
# Screenshot: tol-329-before-inbox-iphone15-alpha-light.png
```

This establishes before/after comparison.

## Questions During QA

If any issues arise:
1. Document in Linear TOL-329 comment
2. Include: exact commit, device, OS, steps to reproduce
3. Attach screenshots showing issue
4. Tag Karn/cloud agent for follow-up

## Summary Checklist

Before declaring QA complete:

- [ ] Fix branch checked out (bcc6a118)
- [ ] Safe fixture used (demo-vault-v2)
- [ ] Inbox padding verified present
- [ ] Sidebar padding verified present
- [ ] Other sections spot-checked
- [ ] Screenshots captured with proper naming
- [ ] Captions include commit/device/fixture
- [ ] Uploaded to Linear Resources (not public)
- [ ] QA report added to Linear comment
- [ ] Comparison test (optional) confirms main is broken

**Result**: Ready for merge decision based on QA evidence.
