# TOL-329 QA Instructions

## Issue
Mobile Alpha: styling and spacing missing app-wide in lists and sidebar (iPhone screenshots in Linear).

## Root Cause
TOL-315 commit `fe9b657c` (Nov 4) introduced dynamic Pressable style functions that failed to apply base styles on certain React Native/bundler paths, stripping padding.

## Fix
Reverted to static style references in:
- `apps/mobile/src/ui/MobileListRow.tsx`
- `apps/mobile/src/components/workspace/MobileWorkspaceSidebarItem.internal.tsx`

## Linux Verification (Complete)
```bash
pnpm install --frozen-lockfile
pnpm mobile:typecheck  # ✓ passes
pnpm mobile:lint       # ✓ passes
```

## Native QA (macOS Required)
1. **Setup**: Use `demo-vault-v2/` fixture (exists, verified)
2. **Alpha Channel**: Settings → Advanced → Update Channel → Alpha
3. **Build & Launch**:
   ```bash
   cd ~/code/tolaria
   git fetch origin
   git checkout cursor/tol-329-mobile-spacing-fix-96d7
   pnpm install
   pnpm ios  # or pnpm android
   ```
4. **Verify Restored Spacing**:
   - Open demo-vault-v2 in app
   - Check Inbox list: each note row has visible padding (top/bottom/sides)
   - Open sidebar: workspace/folder items have visible spacing between them
   - Compare to Luca's screenshots in Linear (should match pre-regression spacing)

## Expected Commit
This branch HEAD (after docs consolidation): SHA to be confirmed by Mac tester.

## Unverified Platform Steps on Linux
Cannot render native iOS layout engine or launch Simulator. Structural tests cannot prove NativeWind/native style application. Verification requires Mac device QA.

## Private Data
Luca's screenshots contain private vault content. Never commit, leak titles/content, or upload to public PRs/GitHub/CI.
