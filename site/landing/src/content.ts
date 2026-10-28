// Every fact on the page lives here, with its source. Sources: the Tolaria maintainers' fact sheet (2026-10-26), the
// public GitHub repo + release v2026-10-26, and the live tolaria.md page. Don't add claims that aren't in one of those.
export const RELEASE = { tag: "v2026-10-26", version: "2026.10.26", date: "26 Oct 2026" } // GitHub release, published 2026-10-26 11:53 CET
// Same-site paths on tolaria.md (the landing is served at / next to the docs); absolute URLs in the preview build.
const SITE = __TOLARIA_MD__ ? "" : "https://tolaria.md"
const dl = (file: string) => `https://github.com/refactoringhq/tolaria/releases/download/${RELEASE.tag}/${file}`

export const LINKS = {
  download: `${SITE}/download/`, // auto-detects the platform (live download page)
  releases: `${SITE}/releases/`,
  github: "https://github.com/refactoringhq/tolaria",
  releaseNotes: `https://github.com/refactoringhq/tolaria/releases/tag/${RELEASE.tag}`,
  discord: "https://discord.gg/tRBC2u428B",
  docs: __TOLARIA_MD__ ? "/docs" : "https://tolaria.md/start/install",
  gettingStartedVault: "https://github.com/refactoringhq/tolaria-getting-started",
  refactoring: "https://refactoring.fm",
  lucaX: "https://x.com/lucaronin",
  license: "https://github.com/refactoringhq/tolaria/blob/main/LICENSE",
  trademarks: "https://github.com/refactoringhq/tolaria/blob/main/trademarks.md",
}

export const DOWNLOADS = {
  macSilicon: dl(`Tolaria_${RELEASE.version}_macOS_Silicon.dmg`),
  macIntel: dl(`Tolaria_${RELEASE.version}_macOS_Intel.dmg`),
  windows: dl(`Tolaria_${RELEASE.version}_x64-setup.exe`),
  appImage: dl(`Tolaria_${RELEASE.version}_amd64.AppImage`),
  deb: dl(`Tolaria_${RELEASE.version}_amd64.deb`),
  rpm: dl(`Tolaria-${RELEASE.version}-1.x86_64.rpm`),
}

export const NEWSLETTER_SUBSCRIBERS = "175K" // Refactoring newsletter audience, confirmed by Luca 2026-10-26
export const STARS = "20.3k" // GitHub stargazers 20,345 on 2026-10-26 (fact sheet + GitHub API)

export const DOCS = [
  { title: "Start with a vault", body: "Install Tolaria, open the Getting Started vault, and understand the first launch flow.", href: `${SITE}/start/install` },
  { title: "Understand the model", body: "Learn how notes, properties, types, relationships, custom views, Git, and AI fit together.", href: `${SITE}/concepts/vaults` },
  { title: "Follow workflows", body: "Capture notes, organize the inbox, use wikilinks, create types, push changes, and configure AI.", href: `${SITE}/guides/capture-a-note` },
  { title: "Keep docs current", body: "The maintenance checklist for when code changes affect commands, models, integrations, or platforms.", href: `${SITE}/reference/docs-maintenance` },
]

// Logo heights balance optical weight across different aspect ratios (equal ink area, CircleCI's SVG has top padding).
export const SPONSORS = [
  { name: "Codacy", h: 44, w: 153, logo: "/media/codacy.svg", href: "https://codacy.com/tolaria?utm_source=tolaria&utm_medium=website&utm_campaign=refactoring", line: "Quality and security checks that keep AI-assisted engineering accountable." },
  { name: "CodeScene", h: 36, w: 188, logo: "/media/codescene.svg", href: "https://codescene.com/?utm_source=tolaria&utm_medium=website&utm_campaign=refactoring", line: "Code Health insight for keeping technical debt visible and actionable." },
  { name: "CircleCI", h: 47, w: 182, logo: "/media/circleci.svg", href: "https://circleci.com/?utm_source=tolaria&utm_medium=website&utm_campaign=refactoring", line: "Reliable CI for build, test, and release confidence, now also locally for agents." },
  { name: "Unblocked", h: 37, w: 183, logo: "/media/unblocked.svg", href: "https://getunblocked.com/?utm_source=tolaria&utm_medium=website&utm_campaign=refactoring", line: "Engineering context that helps developers and agents understand the codebase." },
]

// Verbatim from tolaria.md (they are about Luca's newsletter, Refactoring). Jordan's quote is left out because it cites an older subscriber count (100k) that contradicts the current 175K.
export const QUOTES = [
  { who: "Gregor O.", role: "CTO", img: "/media/gregor.webp", text: "Great newsletter for everyone interested in topics all the way from Software to People working well together! Luca is providing a LOT of value filled with actionable insights in a very easy to read way." },
  { who: "Ananth R.", role: "Engineering Manager & O'Reilly Instructor", img: "/media/ananth.webp", text: "Luca's newsletter is one of the best in the industry for software engineers and engineers leaders. I highly recommend to anyone who would like to build high performing engineering teams." },
]

// iPhone/iPad public TestFlight beta (from Karn, 2026-10-26).
export const TESTFLIGHT_URL = "https://testflight.apple.com/join/7aPD4GAB"

// Real iPhone captures, when Karn sends them (e.g. "/media/ios-list.webp", "/media/ios-note.webp").
// Empty = the phone frame shows the HTML recreation (components/landing/PhoneWindow.tsx).
export const MOBILE_SCREENSHOTS: string[] = []
