import { useEffect, useState } from "react"
import {
  AppleLogoIcon, ArrowRightIcon, ArrowUpRightIcon, CheckIcon, CloudSlashIcon, CodeIcon, CopyIcon, DeviceMobileIcon,
  
  ArrowsClockwiseIcon, DownloadSimpleIcon, FileTextIcon, FlowArrowIcon, GraphIcon, RocketIcon, GitBranchIcon, GithubLogoIcon, HeartIcon, KeyboardIcon, LinuxLogoIcon, StarIcon, WindowsLogoIcon,
} from "@phosphor-icons/react"

import { MacBook } from "@/components/landing/HeroWindow"
import { PhoneWindow } from "@/components/landing/PhoneWindow"
import { Peel } from "@/components/landing/Peel"
import { HeroBg, heroBgFromUrl } from "@/components/landing/HeroBg"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { AiDemo, EditorDemo, GitDemo, RelationsDemo, ThemeDemo } from "@/components/landing/Demos"
import { DOCS, DOWNLOADS, LINKS, TESTFLIGHT_URL, NEWSLETTER_SUBSCRIBERS, QUOTES, RELEASE, SPONSORS, STARS } from "./content"
import { startMotion } from "./motion"

// Tolaria landing page on the Refactoring brand. Polish rules adapted from elayadesign/ai-design-skills (MIT).
// Facts and links: ./content.ts.
const focusRing = "focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
const ext = { target: "_blank", rel: "noopener" } as const
// new tab only for other sites: on tolaria.md the docs, download and releases links are same-site paths
const extIf = (href: string) => (/^https?:/.test(href) ? ext : {})

export default function App() {
  useEffect(() => startMotion(), [])
  if (location.pathname !== "/" && location.pathname !== "/index.html") return <NotFound />
  return (
    <>
      <a href="#main" className="sr-only z-50 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground focus:not-sr-only focus:fixed focus:top-4 focus:left-4">Skip to content</a>
      <TopBar />
      <main id="main" className="scroll-mt-24">
        <Hero />
        <Showcase />
        <Peel />
        <Sponsors />
        <Features />
        <Principles />
        <Download />
        <Author />
        <Docs />
        <FinalCta />
      </main>
      <Footer />
    </>
  )
}

function Logo({ className = "h-6" }: { className?: string }) {
  return <img src="/media/tolaria-drop.svg" alt="" width={14} height={19} className={`w-auto ${className}`} />
}

// Floating pill nav: fixed over the full-bleed blue hero, always frosted glass
// (translucent white fill + backdrop blur), so it reads the same on blue and on the white sections below.
function TopBar() {
  return (
    <nav aria-label="Tolaria" className="fixed inset-x-0 top-[calc(env(safe-area-inset-top)+0.75rem)] z-40 mx-auto flex w-fit max-w-[calc(100%-24px)] items-center gap-1 rounded-2xl border border-white/40 bg-background/80 p-2 shadow-[0_8px_30px_-12px_rgba(10,30,80,0.35)] backdrop-blur-xl backdrop-saturate-150">
      <a href="#top" aria-current="page" className={`flex items-center gap-2 rounded-xl py-1.5 pr-3 pl-2 transition-colors duration-300 ease-out-weighted hover:bg-muted ${focusRing}`}>
        <Logo /><span className="font-display text-lg leading-none">Tolaria</span>
      </a>
      <span className="hidden h-6 w-px bg-border sm:block" aria-hidden />
      {[["Features", "#features"], ["Download", "#download"], ["Docs", __TOLARIA_MD__ ? "/docs" : "#docs"]].map(([l, h]) => (
        <a key={h} href={h} className={`hidden rounded-xl px-3 py-2 text-sm font-semibold text-muted-foreground transition-colors duration-300 ease-out-weighted hover:bg-muted hover:text-foreground sm:block ${focusRing}`}>{l}</a>
      ))}
      <a href={LINKS.github} {...ext} aria-label={`Tolaria on GitHub, ${STARS} stars`} className={`flex items-center gap-1 rounded-xl px-3 py-2 text-sm font-semibold text-muted-foreground transition-colors duration-300 ease-out-weighted hover:bg-muted hover:text-foreground ${focusRing}`}>
        <GithubLogoIcon weight="fill" className="size-4" /><span className="hidden min-[400px]:inline">{STARS}</span>
      </a>
      <a href={LINKS.download} className={`press flex items-center gap-1 rounded-xl bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground transition-[transform,opacity] duration-300 ease-out-weighted hover:opacity-90 ${focusRing}`}>
        <DownloadSimpleIcon weight="bold" className="size-4" />Download
      </a>
    </nav>
  )
}

function platform() {
  const ua = navigator.userAgent
  if (/Windows/i.test(ua)) return "Windows"
  if (/iPhone|iPad|Android/i.test(ua)) return null
  if (/Linux/i.test(ua)) return "Linux"
  return "macOS"
}

function Hero() {
  const [os, setOs] = useState<string | null>("macOS")
  useEffect(() => setOs(platform()), [])
  const OsIcon = os === "Windows" ? WindowsLogoIcon : os === "Linux" ? LinuxLogoIcon : AppleLogoIcon
  const [bg] = useState(heroBgFromUrl)
  return (
    // Full-bleed blue: edge to edge from y=0 (the fixed nav floats over it); content keeps the 6xl column.
    <header id="top" className="hero-band relative isolate overflow-hidden bg-primary pt-[calc(env(safe-area-inset-top)+7rem)] text-primary-foreground sm:pt-[calc(env(safe-area-inset-top)+9rem)]">
        {bg && <HeroBg />}
        <div className="min-w-0">
          <a href={LINKS.releaseNotes} {...ext} className={`rise group inline-flex items-center gap-2 rounded-full bg-primary-foreground/15 py-1 pr-3 pl-1 text-sm font-medium backdrop-blur-md transition-[transform,background-color] duration-300 ease-out-weighted hover:bg-primary-foreground/25 ${focusRing}`} style={{ ["--i" as string]: 0 }}>
            <span className="rounded-full bg-primary-foreground px-2 text-xs font-semibold text-app-ink">New</span>
            <span className="sm:hidden">Hybrid look and Skills</span><span className="hidden sm:inline">Hybrid look and Skills in the AI panel</span>
            <ArrowRightIcon weight="bold" className="size-4 transition-transform duration-500 ease-out-weighted group-hover:translate-x-0.5" />
          </a>
          <h1 className="mt-5 font-display text-4xl text-balance sm:text-5xl lg:text-6xl">
            <span className="ml"><span className="lg:whitespace-nowrap" style={{ ["--i" as string]: 0 }}>A second brain for the AI era.</span></span>
            <span className="ml"><span style={{ ["--i" as string]: 1 }}>Free forever.</span></span>
          </h1>
          <p className="rise mt-3 max-w-[640px] text-lg text-pretty text-primary-foreground/90" style={{ ["--i" as string]: 2 }}>
            Organize your notes as Markdown files, with native relationships, Git, local agents, and direct AI model providers.
          </p>
          <div className="rise mt-6 flex flex-wrap items-center gap-2 sm:gap-3" style={{ ["--i" as string]: 3 }}>
            <a href={os ? LINKS.download : "#download"} className={`press inline-flex items-center gap-2 rounded-xl bg-primary-foreground px-4 py-3 text-base font-semibold text-app-ink transition-transform duration-500 ease-out-weighted hover:-translate-y-0.5 ${focusRing}`}>
              {os ? <OsIcon weight="fill" className="size-5" /> : <DownloadSimpleIcon weight="bold" className="size-5" />}
              {os ? `Download for ${os}` : "Get Tolaria"}
            </a>
            <a href={TESTFLIGHT_URL} {...ext} className={`press inline-flex items-center gap-2 rounded-xl bg-primary-foreground/20 px-4 py-3 text-base font-semibold backdrop-blur-md transition-[transform,background-color] duration-500 ease-out-weighted hover:-translate-y-0.5 hover:bg-primary-foreground/30 ${focusRing}`}>
              <DeviceMobileIcon weight="fill" className="size-5" /><span className="sm:hidden">iPhone beta</span><span className="hidden sm:inline">iPhone and iPad beta</span>
            </a>
            <a href={LINKS.github} {...ext} className={`press hidden items-center gap-2 rounded-xl px-3 py-3 text-base font-semibold backdrop-blur-md transition-[transform,background-color] duration-500 ease-out-weighted hover:-translate-y-0.5 hover:bg-primary-foreground/20 sm:inline-flex ${focusRing}`}>
              <GithubLogoIcon weight="fill" className="size-5" />Star<span className="rounded-md bg-primary-foreground/15 px-1.5 text-sm">{STARS}</span>
            </a>
          </div>
          <p className="rise mt-4 text-sm text-primary-foreground/80" style={{ ["--i" as string]: 4 }}>
            Also on <a href="#download" className="font-semibold underline underline-offset-4">Windows and Linux</a> (early support). Open source, no account.
          </p>
        </div>
    </header>
  )
}

// The product, right under the hero: a two-device lineup on the plain page. The MacBook (the live desktop recreation)
// sits slightly left of centre and the iPhone overlaps its bottom-right corner, so the pair reads as one composition.
function Showcase() {
  return (
    <section aria-label="Illustrations of Tolaria on a MacBook and an iPhone, with the colour-coded note types" className="hero-overlap relative z-10 mx-auto max-w-6xl px-4 sm:px-6">
      <div className="relative pb-10 sm:pb-12">
        <div className="rise relative mx-auto max-w-[1000px]" style={{ ["--i" as string]: 5 }}>
          <MacBook className="relative z-10 w-[92%] sm:w-[86%] lg:w-[84%]" />
          <PhoneWindow className="absolute right-0 -bottom-8 z-20 w-[28%] max-w-[210px] min-w-[104px] sm:right-[2%] sm:-bottom-10 sm:w-[20%] lg:right-[3%] lg:w-[21%]" />
        </div>
      </div>
    </section>
  )
}

function Sponsors() {
  return (
    <section aria-labelledby="sponsors-h" className="mx-auto max-w-6xl px-4 pt-20 sm:px-6 sm:pt-28">
      <div className="reveal flex justify-center">
        <h2 id="sponsors-h" className="px-3 py-1 font-heading text-sm font-semibold text-muted-foreground">Backed by the tools behind the work</h2>
      </div>
      <ul className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {SPONSORS.map((s, i) => (
          <li key={s.name} className="reveal" style={{ ["--i" as string]: i }}>
            <a href={s.href} {...ext} title={s.line} className={`press group flex h-20 items-center justify-center rounded-2xl border bg-card transition-[transform,box-shadow,border-color] duration-500 ease-out-weighted hover:-translate-y-1 hover:border-primary/40 hover:shadow-lg ${focusRing}`}>
              <img src={s.logo} alt={s.name} width={s.w} height={s.h} loading="lazy" style={{ ["--h" as string]: `${s.h}px` }} className="h-[calc(var(--h)*0.8)] w-auto max-w-[86%] object-contain opacity-85 transition-opacity duration-300 ease-out-weighted group-hover:opacity-100 sm:h-[var(--h)]" />
            </a>
          </li>
        ))}
      </ul>
    </section>
  )
}

const FEATURES = [
  { k: "Editor", title: "Writes like Notion, saves as Markdown", body: "Block editing with slash commands, wikilinks, raw Markdown, whiteboards, media previews, and table navigation. Everything durable stays in vault files.", demo: EditorDemo },
  { k: "Relationships", title: "Relationships as first-class citizens", body: "Connect notes with properties like Belongs to and Has notes. Types are lenses for finding notes, not schemas: no required fields, no validation.", demo: RelationsDemo },
  { k: "Version control", title: "A Git client, built in", body: "Commit, push, and browse history from within the app, with version history for every single note. Sync across devices with the tool you already trust for code.", demo: GitDemo },
  { k: "AI", title: "Local agents and direct models", body: "Run coding agents such as Claude Code, Codex, GitHub Copilot, OpenCode, and Pi on your vault, with Vault Safe or Power User permissions, or chat with local and API models over your notes. Claude Code can now use your Skills.", demo: AiDemo },
  { k: "Appearance", title: "Make it yours", body: `Light, dark, or the new Hybrid look from ${RELEASE.tag}: a dark sidebar with light note content. Pick it in Settings, Appearance, along with language, note width, and layout.`, demo: ThemeDemo, href: LINKS.releaseNotes },
]

// Bento: Editor + Relationships pair up, Git is the wide card (demo beside the copy, mirrored), then AI + Appearance.
const WIDE = new Set(["Version control"])
function Features() {
  return (
    <section id="features" aria-labelledby="features-h" className="mx-auto max-w-6xl px-4 pt-24 sm:px-6 sm:pt-32">
      <SectionHead id="features-h" k="What you get" title={<>Plain files, a real editor,<br className="hidden sm:block" /> Git and AI in one app</>} />
      <div className="mt-12 grid gap-4 md:grid-cols-2">
        {FEATURES.map((f, i) => {
          const wide = WIDE.has(f.k), flip = f.k === "Version control"
          return (
            <article key={f.title} className={`reveal group flex flex-col rounded-2xl border bg-card p-2 transition-[opacity,transform,box-shadow,border-color] duration-500 ease-out-weighted hover:-translate-y-1 hover:border-primary/40 hover:shadow-lg ${wide ? `md:col-span-2 lg:grid lg:items-center lg:gap-4 lg:[&_.fx]:h-80 ${flip ? "lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]" : "lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]"}` : ""}`} style={{ ["--i" as string]: wide ? 0 : i % 2 }}>
              <div className={wide && flip ? "lg:order-2" : ""}><f.demo /></div>
              <div className={`flex flex-1 flex-col p-4 ${wide ? "lg:p-8" : ""}`}>
                <p className="text-sm font-semibold text-app-ink">{f.k}</p>
                <h3 className={`mt-1 font-heading font-bold text-balance ${wide ? "text-2xl lg:text-3xl" : "text-2xl"}`}>{f.title}</h3>
                <p className={`mt-2 text-pretty text-muted-foreground ${wide ? "text-base lg:text-lg" : "text-base"}`}>{f.body}</p>
                {f.href && <a href={f.href} {...ext} className={`mt-3 inline-flex w-fit items-center gap-1 rounded-md text-sm font-semibold text-primary underline-offset-4 hover:underline ${focusRing}`}>Read the release notes<ArrowUpRightIcon className="size-4" /></a>}
              </div>
            </article>
          )
        })}
      </div>
    </section>
  )
}

// Icon tiles: a brand colour (600) on its light shade (100). Five brand colours reused across Principles and Docs,
// so neighbours differ without turning the page into a rainbow. Literal classes so Tailwind keeps them.
const TONE = {
  blue: "bg-blue-100 text-blue-600", green: "bg-green-100 text-green-600", orange: "bg-orange-100 text-orange-600",
  purple: "bg-purple-100 text-purple-600", red: "bg-red-100 text-red-600",
} as const
type Tone = keyof typeof TONE
const tile = "flex size-10 items-center justify-center rounded-xl"

const PRINCIPLES: { icon: typeof FileTextIcon; tone: Tone; title: string; body: string }[] = [
  { icon: FileTextIcon, tone: "blue", title: "Files-first", body: "Your notes are plain Markdown files. Portable, readable by any editor, no export step." },
  { icon: GitBranchIcon, tone: "orange", title: "Git-first", body: "Every vault is a Git repository: full history, any remote, no dependency on Tolaria servers." },
  { icon: CloudSlashIcon, tone: "green", title: "Offline-first, zero lock-in", body: "No accounts, no subscriptions, no cloud dependencies. Your vault works offline and always will." },
  { icon: CodeIcon, tone: "purple", title: "Open source", body: "Tolaria is free and open source, licensed AGPL-3.0-or-later." },
  { icon: KeyboardIcon, tone: "blue", title: "Keyboard-first", body: "Built for power users: the editor and the command palette are designed around the keyboard." },
  { icon: HeartIcon, tone: "red", title: "Built from real use", body: "Made to run Luca's own vault of 10,000+ notes, every day. Every feature solved a real problem." },
]

// A borderless two-column list beside a left-aligned, sticky heading (no cards: breaks the run of card grids).
function Principles() {
  return (
    <section id="principles" aria-labelledby="principles-h" className="scroll-mt-24 mx-auto max-w-6xl px-4 pt-24 sm:px-6 sm:pt-32">
      <SectionHead id="principles-h" k="Principles" title={<>Your data belongs to you,<br className="hidden sm:block" /> not to any app</>} />
      <ul className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {PRINCIPLES.map((p, i) => (
          <li key={p.title} className="reveal rounded-2xl border bg-card p-6" style={{ ["--i" as string]: i }}>
            <span className={`${tile} ${TONE[p.tone]}`}><p.icon weight="fill" className="size-6" /></span>
            <h3 className="mt-4 font-heading text-lg font-bold">{p.title}</h3>
            <p className="mt-1 text-base text-pretty text-muted-foreground">{p.body}</p>
          </li>
        ))}
      </ul>
    </section>
  )
}

// One download panel: a segmented platform switcher (shadcn Tabs) over a single slot. Every platform fills the same
// three rows (identity, actions, detail line), and all panels share one grid cell, so the card never changes height.
type OsId = "mac" | "windows" | "linux" | "ios"
function detectOs(): OsId {
  const ua = navigator.userAgent
  if (/iPhone|iPad|iPod/i.test(ua) || (/Macintosh/i.test(ua) && navigator.maxTouchPoints > 1)) return "ios"
  if (/Android/i.test(ua)) return "mac" // no Android build yet: fall back to macOS
  if (/Windows/i.test(ua)) return "windows"
  if (/Linux|X11/i.test(ua)) return "linux"
  return "mac"
}
type Link = { label: string; href: string; ext?: boolean }
const PLATFORMS: { id: OsId; tab: string; icon: typeof AppleLogoIcon; title: string; note: string; badge?: string; primary: Link; secondary: Link[]; detail: React.ReactNode }[] = [
  { id: "mac", tab: "macOS", icon: AppleLogoIcon, title: "Tolaria for macOS", note: "Apple Silicon and Intel", primary: { label: "Download for Apple Silicon", href: DOWNLOADS.macSilicon }, secondary: [{ label: "Intel", href: DOWNLOADS.macIntel }], detail: <Brew /> },
  { id: "windows", tab: "Windows", icon: WindowsLogoIcon, title: "Tolaria for Windows", note: "x64 installer", badge: "Early support", primary: { label: "Download for Windows", href: DOWNLOADS.windows }, secondary: [], detail: <>Windows support is new, so expect rough edges. Tell us what breaks on <a href={LINKS.discord} {...ext} className="font-semibold text-primary underline-offset-4 hover:underline">Discord</a>.</> },
  { id: "linux", tab: "Linux", icon: LinuxLogoIcon, title: "Tolaria for Linux", note: "x64 builds", badge: "Early support", primary: { label: "Download AppImage", href: DOWNLOADS.appImage }, secondary: [{ label: ".deb", href: DOWNLOADS.deb }, { label: ".rpm", href: DOWNLOADS.rpm }], detail: <>The AppImage runs on most distributions. Pick .deb for Debian and Ubuntu, .rpm for Fedora.</> },
  { id: "ios", tab: "iPhone", icon: DeviceMobileIcon, title: "Tolaria for iPhone and iPad", note: "Public TestFlight beta", badge: "Beta", primary: { label: "Join the TestFlight beta", href: TESTFLIGHT_URL, ext: true }, secondary: [], detail: <>Install Apple's TestFlight app, then open the invite on your iPhone or iPad.</> },
]

function Download() {
  const [os, setOs] = useState<OsId>("mac")
  useEffect(() => setOs(detectOs()), [])
  const idx = PLATFORMS.findIndex((p) => p.id === os)
  return (
    <section id="download" aria-labelledby="download-h" className="mx-auto max-w-6xl px-4 pt-24 sm:px-6 sm:pt-32">
      <SectionHead id="download-h" k={`Tolaria ${RELEASE.tag}, released ${RELEASE.date}`} title="Download Tolaria" />
      <Tabs value={os} onValueChange={(v) => setOs(v as OsId)} className="reveal mx-auto mt-12 max-w-[880px] gap-0 rounded-3xl border bg-card p-2">
        <TabsList aria-label="Platform" className="relative grid w-full grid-cols-4 rounded-2xl bg-muted p-1 group-data-horizontal/tabs:h-auto">
          <span aria-hidden className="absolute inset-y-1 left-1 w-[calc((100%-8px)/4)] rounded-xl bg-background shadow-sm transition-transform duration-500 ease-out-weighted motion-reduce:transition-none" style={{ transform: `translateX(${idx * 100}%)` }} />
          {PLATFORMS.map((p) => (
            <TabsTrigger key={p.id} value={p.id} className={`relative z-10 h-11 gap-2 rounded-xl text-sm font-semibold text-muted-foreground transition-colors duration-300 ease-out-weighted data-active:bg-transparent data-active:text-foreground data-active:shadow-none ${focusRing}`}>
              <p.icon weight="fill" className="hidden size-5 min-[480px]:block" />{p.tab}
            </TabsTrigger>
          ))}
        </TabsList>
        <div className="grid grid-cols-[minmax(0,1fr)]">
          {PLATFORMS.map((p) => {
            const on = p.id === os
            return (
              <div key={p.id} role="tabpanel" aria-label={p.title} aria-hidden={!on} inert={!on} className={`flex flex-col [grid-area:1/1] transition-[opacity,transform] duration-300 ease-out-weighted motion-reduce:transform-none ${on ? "opacity-100" : "pointer-events-none translate-y-2 opacity-0"}`}>
                <div className="flex flex-1 flex-col gap-6 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-6">
                  <div className="flex min-w-0 items-center gap-4">
                    <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-app-light text-app"><p.icon weight="fill" className="size-7" /></span>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2"><h3 className="font-heading text-lg font-bold">{p.title}</h3>{p.badge && <span className="rounded-full bg-app-tint px-2 py-0.5 text-xs font-semibold text-app-ink">{p.badge}</span>}</div>
                      <p className="text-sm text-muted-foreground">{p.note}</p>
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-wrap gap-2">
                    <Btn {...p.primary} primary />
                    {p.secondary.map((l) => <Btn key={l.label} {...l} />)}
                  </div>
                </div>
                <div className="flex min-h-16 items-center rounded-2xl bg-muted/60 px-4 py-3 text-sm text-pretty text-muted-foreground sm:px-6">{p.id === "mac" ? p.detail : <p>{p.detail}</p>}</div>
              </div>
            )
          })}
        </div>
      </Tabs>
      <p className="reveal mx-auto mt-6 w-fit px-4 py-2 text-center text-sm text-muted-foreground">
        Not sure which one? <a href={LINKS.download} className="font-semibold text-primary underline-offset-4 hover:underline">The download page picks for you</a>. Older versions are in the <a href={LINKS.releases} className="font-semibold text-primary underline-offset-4 hover:underline">release history</a>.
      </p>
    </section>
  )
}
function Btn({ label, href, primary, ext: e }: Link & { primary?: boolean }) {
  return (
    <a href={href} {...(e ? ext : {})} className={`press inline-flex h-12 flex-1 items-center justify-center gap-2 rounded-xl px-5 text-base font-semibold whitespace-nowrap transition-[transform,background-color,border-color] duration-300 ease-out-weighted hover:-translate-y-0.5 sm:flex-none ${focusRing} ${primary ? "basis-full bg-primary text-primary-foreground sm:basis-auto" : "border bg-background hover:border-primary/40 hover:bg-app-tint"}`}>
      {e ? <DeviceMobileIcon weight="fill" className="size-5" /> : <DownloadSimpleIcon weight="bold" className="size-5" />}{label}
    </a>
  )
}
function Brew() {
  const cmd = "brew install --cask tolaria"
  const [state, setState] = useState<"idle" | "copied" | "error">("idle")
  const copy = async () => {
    try { await navigator.clipboard.writeText(cmd); setState("copied"); setTimeout(() => setState("idle"), 2000) }
    catch { setState("error") }
  }
  return (
    <div className="w-full">
      <div className="flex items-center gap-3">
        <span className="hidden shrink-0 sm:inline">Or with Homebrew</span>
        <div className="flex min-w-0 flex-1 items-center gap-2 rounded-xl border bg-background py-1 pr-1 pl-3 font-mono text-xs text-foreground min-[420px]:text-sm">
          <span className="text-muted-foreground" aria-hidden>$</span><code className="flex-1 truncate">{cmd}</code>
          <button type="button" onClick={copy} className={`press inline-flex h-8 items-center gap-1 rounded-lg px-2 font-sans text-xs font-semibold text-muted-foreground transition-colors duration-300 ease-out-weighted hover:bg-muted hover:text-foreground ${focusRing}`} aria-live="polite">
            {state === "copied" ? <><CheckIcon weight="bold" className="size-4" />Copied</> : <><CopyIcon weight="fill" className="size-4" />Copy</>}
          </button>
        </div>
      </div>
      {state === "error" && <p role="alert" className="mt-2 text-sm text-destructive">Couldn't copy to the clipboard. Select the command and copy it by hand.</p>}
    </div>
  )
}

function Author() {
  return (
    <section aria-labelledby="author-h" className="mx-auto max-w-6xl px-4 pt-24 sm:px-6 sm:pt-32">
      <div className="reveal grid gap-8 rounded-3xl border bg-card p-2 lg:grid-cols-2 lg:gap-6">
        <img src="/media/luca.webp" alt="Luca Rossi waving hello" width={960} height={540} loading="lazy" className="aspect-video w-full rounded-2xl object-cover lg:aspect-auto lg:h-full" />
        <div className="self-center p-4 lg:p-8 lg:pl-2">
          <p className="text-sm font-semibold text-app-ink">Made with love</p>
          <h2 id="author-h" className="mt-1 font-display text-4xl text-balance">Built by Luca, for Luca</h2>
          <p className="mt-4 text-base text-pretty text-muted-foreground">
            Tolaria is born from 5 years of full-time writing at <a href={LINKS.refactoring} {...ext} className="font-semibold text-primary underline-offset-4 hover:underline">Refactoring</a>, with 300+ articles about software engineering and developer productivity. None of the existing tools matched what I wanted, so I built one myself. Today it runs my life: a vault of 10,000+ notes.
          </p>
          <dl className="mt-6 grid grid-cols-2 gap-3 xl:grid-cols-4">
            {[["5 years", "full-time writing"], ["300+", "articles published"], [NEWSLETTER_SUBSCRIBERS, "newsletter subscribers"], ["10,000+", "notes in my vault"]].map(([v, l]) => (
              <div key={l} className="rounded-xl bg-app-tint p-3"><dt className="sr-only">{l}</dt><dd className="font-heading text-lg leading-6 font-bold text-app-ink">{v}</dd><dd className="mt-0.5 text-sm leading-5 text-muted-foreground">{l}</dd></div>
            ))}
          </dl>
        </div>
      </div>
      <h3 className="reveal mx-auto mt-12 w-fit px-3 py-1 text-center font-heading text-sm font-semibold text-muted-foreground">Readers on the Refactoring newsletter</h3>
      <ul className="mt-4 grid gap-4 md:grid-cols-2">
        {QUOTES.map((q, i) => (
          <li key={q.who} className="reveal" style={{ ["--i" as string]: i }}>
            <figure className="flex h-full flex-col rounded-2xl border bg-card p-6">
              <blockquote className="flex-1 text-base text-pretty">"{q.text}"</blockquote>
              <figcaption className="mt-4 flex items-center gap-3 text-sm">
                <img src={q.img} alt="" width={40} height={40} loading="lazy" className="size-10 rounded-full" />
                <span><span className="block font-semibold">{q.who}</span><span className="text-muted-foreground">{q.role}</span></span>
              </figcaption>
            </figure>
          </li>
        ))}
      </ul>
    </section>
  )
}

// One icon per docs card, in DOCS order (content.ts): start, model, workflows, maintenance.
const DOC_ICONS: { icon: typeof RocketIcon; tone: Tone }[] = [
  { icon: RocketIcon, tone: "blue" }, { icon: GraphIcon, tone: "green" }, { icon: FlowArrowIcon, tone: "orange" }, { icon: ArrowsClockwiseIcon, tone: "purple" },
]
function Docs() {
  return (
    <section id="docs" aria-labelledby="docs-h" className="mx-auto max-w-6xl px-4 pt-24 sm:px-6 sm:pt-32">
      <SectionHead id="docs-h" k="Documentation" title="Learn the app the way it is built" sub="The docs sit in the app repo, so product behavior, architecture, and guidance evolve together." />
      <ul className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {DOCS.map((d, i) => (
          <li key={d.title} className="reveal group relative flex flex-col rounded-2xl border bg-card p-6 transition-[opacity,transform,box-shadow,border-color] duration-500 ease-out-weighted hover:-translate-y-1 hover:border-primary/40 hover:shadow-lg has-[a:active]:scale-[0.98] has-[a:focus-visible]:ring-3 has-[a:focus-visible]:ring-ring/50" style={{ ["--i" as string]: i }}>
            {(() => { const D = DOC_ICONS[i % DOC_ICONS.length]; return <span className={`${tile} ${TONE[D.tone]}`}><D.icon weight="fill" className="size-6" /></span> })()}
            <h3 className="mt-4 font-heading text-lg font-bold"><a href={d.href} {...extIf(d.href)} className="outline-none after:absolute after:inset-0">{d.title}</a></h3>
            <p className="mt-1 flex-1 text-sm text-pretty text-muted-foreground">{d.body}</p>
            <ArrowUpRightIcon className="mt-4 size-5 text-primary transition-transform duration-500 ease-out-weighted group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
          </li>
        ))}
      </ul>
    </section>
  )
}

function FinalCta() {
  return (
    <section aria-labelledby="cta-h" className="mx-auto max-w-6xl px-4 pt-24 sm:px-6 sm:pt-32">
      <div className="reveal flex flex-col items-center rounded-3xl bg-primary px-6 py-16 text-center text-primary-foreground sm:py-24">
        <span className="flex size-12 items-center justify-center rounded-xl bg-app-light"><Logo className="h-7" /></span>
        <h2 id="cta-h" className="mt-6 max-w-[680px] font-display text-4xl text-balance sm:text-5xl">Free and open source.<br className="hidden sm:block" /> Local-first, Git-first, Markdown.</h2>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <a href={LINKS.download} className={`press inline-flex items-center gap-2 rounded-xl bg-white px-4 py-3 text-base font-semibold text-app-ink transition-transform duration-500 ease-out-weighted hover:-translate-y-0.5 ${focusRing}`}><DownloadSimpleIcon weight="bold" className="size-5" />Download Tolaria</a>
          <a href={LINKS.docs} {...extIf(LINKS.docs)} className={`press inline-flex items-center gap-2 rounded-xl border border-white/30 px-4 py-3 text-base font-semibold text-white transition-[transform,background-color] duration-500 ease-out-weighted hover:-translate-y-0.5 hover:bg-white/10 ${focusRing}`}>Read the docs</a>
        </div>
        <p className="mt-8 max-w-[680px] text-sm text-pretty text-white/80">
          Updates on Tolaria, new features, and the behind the scenes of building in public go out in the <a href={LINKS.refactoring} {...ext} className="font-semibold text-white underline underline-offset-4">Refactoring newsletter</a>, read by {NEWSLETTER_SUBSCRIBERS} subscribers.
        </p>
      </div>
    </section>
  )
}

function Footer() {
  const links: [string, string][] = [["GitHub", LINKS.github], ["Discord", LINKS.discord], ["Docs", LINKS.docs], ["Releases", LINKS.releases], ["License", LINKS.license], ["Trademark policy", LINKS.trademarks]]
  return (
    <footer className="mx-auto mt-16 max-w-6xl px-4 pb-12 sm:px-6">
      <div className="flex flex-col gap-4 rounded-2xl border bg-card p-6 text-sm text-muted-foreground md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3"><Logo /><span>Tolaria is AGPL-3.0-or-later. The name and logo are covered by the trademark policy.</span></div>
        <ul className="flex flex-wrap gap-x-4 gap-y-2">
          {links.map(([l, h]) => <li key={l}><a href={h} {...extIf(h)} className={`rounded font-semibold hover:text-foreground ${focusRing}`}>{l}</a></li>)}
        </ul>
      </div>
      <p className="mx-auto mt-4 w-fit px-3 py-1 text-center text-xs text-muted-foreground">Made by <a href={LINKS.lucaX} {...ext} className="font-semibold hover:text-foreground">Luca Rossi</a> at <a href={LINKS.refactoring} {...ext} className="font-semibold hover:text-foreground">Refactoring</a> <StarIcon weight="fill" className="inline size-3 text-primary" aria-hidden /></p>
    </footer>
  )
}

function SectionHead({ id, k, title, sub }: { id: string; k: string; title: React.ReactNode; sub?: string }) {
  return (
    <div className="reveal mx-auto flex w-fit max-w-[720px] flex-col items-center px-6 py-5 text-center sm:px-8">
      <p className="text-sm font-semibold text-app-ink">{k}</p>
      <h2 id={id} className="mt-2 font-display text-4xl text-balance sm:text-5xl">{title}</h2>
      {sub && <p className="mt-4 text-lg text-pretty text-muted-foreground">{sub}</p>}
    </div>
  )
}

function NotFound() {
  return (
    <main id="main" className="flex min-h-svh flex-col items-center justify-center gap-6 px-4 text-center">
      <span className="flex size-12 items-center justify-center rounded-xl bg-app-light"><Logo className="h-7" /></span>
      <h1 className="font-display text-5xl">Page not found</h1>
      <p className="max-w-[480px] text-lg text-pretty text-muted-foreground">There's no page at {location.pathname}. It may have moved to the docs.</p>
      <div className="flex gap-3">
        <a href="/" className={`press rounded-xl bg-primary px-4 py-3 text-base font-semibold text-primary-foreground ${focusRing}`}>Back to Tolaria</a>
        <a href={LINKS.docs} className={`press rounded-xl border px-4 py-3 text-base font-semibold ${focusRing}`}>Open the docs</a>
      </div>
    </main>
  )
}
