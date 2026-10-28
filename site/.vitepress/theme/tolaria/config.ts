// Node-side helpers for .vitepress/config.ts (no Vue imports, safe to import from the config).
// Landing routes live at the site root and are NOT VitePress pages, so every link into them carries
// target: "_self", which makes VitePress do a full page load instead of a client-side route.
import type { DefaultTheme } from "vitepress"

export const LANDING = { home: "/", features: "/#features", download: "/download/", releases: "/releases/" }

/** Docs sections, shared by the nav dropdown and the docs home cards. */
export const DOC_SECTIONS: DefaultTheme.NavItemWithLink[] = [
  { text: "Overview", link: "/docs/" },
  { text: "Start", link: "/start/install" },
  { text: "Concepts", link: "/concepts/vaults" },
  { text: "Guides", link: "/guides/capture-a-note" },
  { text: "Templates", link: "/templates/portent" },
  { text: "Reference", link: "/reference/supported-platforms" },
  { text: "Troubleshooting", link: "/troubleshooting/vault-not-loading" },
]

/** Top nav that reads as one site with the landing: Features (landing) · Docs (this site) · Releases. Download is a button (Layout.vue). */
export const tolariaNav: DefaultTheme.NavItem[] = [
  { text: "Features", link: LANDING.features, target: "_self" },
  { text: "Docs", activeMatch: "^/(docs|start|concepts|guides|templates|reference|troubleshooting)(/|$)", items: DOC_SECTIONS },
  { text: "Releases", link: LANDING.releases, target: "_self" },
]

/** Slim ASCII bands on the first page of each docs section (Layout.vue reads themeConfig.tolaria.bands). */
export const DOC_BANDS: Record<string, { kicker: string; title: string; text?: string }> = {
  "/start/install": { kicker: "Start here", title: "From download to your first vault", text: "Install Tolaria, launch it, and open the Getting Started vault." },
  "/concepts/vaults": { kicker: "Concepts", title: "The model behind the app", text: "Vaults, notes, types, properties and relationships, all plain files." },
  "/guides/capture-a-note": { kicker: "Guides", title: "Workflows, step by step", text: "Capture, organize, link, view, sync and ask the AI." },
  "/reference/supported-platforms": { kicker: "Reference", title: "The exact details", text: "File layout, frontmatter, expressions, filters and shortcuts." },
  "/troubleshooting/vault-not-loading": { kicker: "Troubleshooting", title: "When something is off", text: "Fixes for vault loading, Git auth, agents, providers and conflicts." },
}

/** themeConfig fragment: logo goes back to the landing; options read by Layout.vue live under `tolaria`. */
export const tolariaThemeConfig = {
  logoLink: { link: LANDING.home, target: "_self" },
  siteTitle: "Tolaria",
  nav: tolariaNav,
  tolaria: { github: "https://github.com/refactoringhq/tolaria", download: LANDING.download, stars: "9,946", bands: DOC_BANDS },
}
