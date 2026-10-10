# 0197: Persist app-managed mobile vaults independently of provider imports

Date: 2026-10-10
Status: Accepted for the mobile foundation branch

## Decision

Git working copies live under Documents/Git Vaults with generated, validated
identifiers. A separate catalog contains only identifiers, labels, credential-free
GitHub URLs, and the active identifier. Validate a pending catalog before publishing
it by rename, retaining the previous complete catalog for interrupted-write recovery.
Do not silently replace corrupt metadata with an empty catalog.

GitHub tokens live only in SecureStore. Authorization, restoration, repository
listing, and refresh use generation checks; signing out invalidates older replies.
Serialize credential writes so a delayed sign-in save cannot outlive a later clear.

The app owns one editor preparation registry. The vault manager disables workspace
shortcuts and freezes editors during disk replacement. Refresh selection from disk
afterwards, retaining the selected note when possible. Progress state is separate
from workspace hydration to avoid repeated large-vault scans.

## Limits

This does not implement file-provider sync. The current import path is explicitly
labelled as a local copy until durable live-folder access is implemented. GitHub
device authorization needs a configured public client ID; no client secret ships
in the app. Manual sync stops on divergence without force-pushing or merging.
The catalog has recovery protection; ordinary note writes still need a separate
crash-durability pass. Mobile analytics remain disabled until the tablet has a
consent/settings integration; this experimental build must not silently start
transmitting usage or account information.
