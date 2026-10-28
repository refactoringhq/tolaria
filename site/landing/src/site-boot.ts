// Site-specific startup. The public build (tolaria.md) needs none: no service worker, no private brand fonts.
// The preview build swaps this module for its own through the "@site-boot" alias in vite.config.ts.
export function boot() {}
