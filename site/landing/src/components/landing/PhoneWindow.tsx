import { useEffect, useRef, useState } from "react"
import {
  ArchiveIcon, BatteryFullIcon, CaretDownIcon, CellSignalFullIcon, CheckIcon, CodeIcon, CommandIcon, DotsThreeIcon, FileTextIcon,
  FolderIcon, FunnelSimpleIcon, GearSixIcon, LinkSimpleIcon, ListBulletsIcon, MagnifyingGlassIcon, PlusIcon, StarIcon,
  TextBIcon, TextHIcon, TextItalicIcon, TrayIcon, WrenchIcon, WifiHighIcon, ArrowsClockwiseIcon, EyeIcon,
} from "@phosphor-icons/react"
import { MOBILE_SCREENSHOTS } from "@/content"
import { TYPES, type TypeKey, ESSAY, VAULT, NoteTable, MermaidFlow, CodeBlock, TypeChip } from "./mock-notes"
import { reducedMotion } from "@/motion"

// Tolaria on iPhone, in an iPhone frame: a light-mode HTML recreation matched to Karn's iOS captures
// (screens/ios/2026-10-26-ios-light-notelist.png, -note.png, -sidebar.png; 402x874 pt, iPhone Pro).
// To show real screens instead, list them in MOBILE_SCREENSHOTS (content.ts): the frame then crossfades the images.
// Story (12s loop, motion.css .mw): Inbox list -> the sidebar slides in and Projects is tapped -> Projects list ->
// "Get familiar with Tolaria" opens -> the first checklist item is ticked -> back.
const W = 402, H = 874
const C = { rule: "#e9e9e7", ink: "#37352f", head: "#2f2d27", muted: "#787774", faint: "#9b9a97", blue: "#2c5cf6" }

// screen="note": a static frame on the "From notes to essays" essay (used by the Peel to Markdown stage).
export function PhoneWindow({ className = "", screen = "loop", style }: { className?: string; screen?: "loop" | "note"; style?: React.CSSProperties }) {
  const box = useRef<HTMLDivElement>(null)
  const [s, setS] = useState(0.6)
  useEffect(() => {
    const ro = new ResizeObserver(([e]) => setS(e.contentRect.width / (W + 24)))
    ro.observe(box.current!)
    return () => ro.disconnect()
  }, [])
  return (
    <div ref={box} className={className} style={{ ...style, height: (H + 24) * s }}>
      <div className="origin-top-left rounded-[64px] bg-[#0b0b0c] p-3 shadow-2xl shadow-blue-950/30 ring-1 ring-black/20" style={{ width: W + 24, height: H + 24, transform: `scale(${s})` }}>
        <div className="relative size-full overflow-hidden rounded-[52px] bg-white text-left" style={{ color: C.ink }}>
          {screen === "note" ? <NoteScreen /> : MOBILE_SCREENSHOTS.length ? <Shots /> : <Recreation />}
          <div aria-hidden className="absolute top-3 left-1/2 h-[34px] w-[122px] -translate-x-1/2 rounded-full bg-black" />
        </div>
      </div>
    </div>
  )
}

function Shots() {
  const [i, setI] = useState(0)
  useEffect(() => {
    if (reducedMotion() || MOBILE_SCREENSHOTS.length < 2) return
    const t = setInterval(() => setI((n) => (n + 1) % MOBILE_SCREENSHOTS.length), 3500)
    return () => clearInterval(t)
  }, [])
  return MOBILE_SCREENSHOTS.map((src, n) => (
    <img key={src} src={src} alt={n === 0 ? "Tolaria on iPhone" : ""} loading="lazy" decoding="async"
      className={`absolute inset-0 size-full object-cover transition-opacity duration-700 ease-out-weighted ${n === i ? "opacity-100" : "opacity-0"}`} />
  ))
}

// Inbox rows span several types, each with its own colour (same types as the Mac's sidebar).
const INBOX: [string, string, TypeKey][] = [
  ["Writing is thinking", "You don't write down what you think. You find out what you think by trying to write it down...", "evergreen"],
  [ESSAY.title, ESSAY.lede, "essay"],
  ["A Philosophy of Software Design", "Deep modules: simple interfaces that hide a lot of complexity. Highlights from chapters 4–6...", "reading"],
  ["Agents need context, not prompts", "The best agent setups I've seen don't have clever prompts. They have great context...", "idea"],
  ["Jordan Lee", "Staff engineer, platform team. Wants to compare notes on onboarding docs...", "person"],
  ["Weekly digest #42", "Seven reads from this week: monorepos, on-call fatigue, writing design docs...", "digest"],
  ["Tolaria", "Notes, links and decisions about Tolaria, the Markdown knowledge base...", "topic"],
]
const PROJECTS: [string, string, TypeKey][] = [
  ["Get familiar with Tolaria", "Use this checklist as a 15–20 minute tour of Tolaria. Every link opens a real file you can...", "project"],
  ["Project Dashboard", "The block below is stored as fenced HTML inside this Markdown note. Tolaria renders it...", "project"],
  ["Newsletter redesign", "New layout for the weekly issue: shorter intro, one deep dive, links at the bottom...", "project"],
  ["Podcast season 3", "Guest list, recording schedule and the editing checklist for the next ten episodes...", "project"],
  ["Q4 reading list", "Five books on engineering management and writing, with a note per chapter...", "project"],
]

function List({ title, rows, project, className }: { title: string; rows: [string, string, TypeKey][]; project?: boolean; className: string }) {
  return (
    <div className={`absolute inset-0 bg-white ${className}`}>
      <div className="flex h-[52px] items-center justify-between px-4" style={{ borderBottom: `1px solid ${C.rule}` }}>
        <span className="text-[15px] font-medium" style={{ color: C.head }}>{title}</span><MagnifyingGlassIcon className="size-[18px]" style={{ color: C.muted }} />
      </div>
      {rows.map(([t, b, k], i) => { const I = TYPES[k].icon; return (
        <div key={t} className="relative h-[98px] px-4 pt-[15px]" style={{ borderBottom: `1px solid ${C.rule}` }}>
          {project && i === 0 && <div className="m-tap absolute inset-0" style={{ background: TYPES.project.tint }} />}
          <div className="relative flex items-center justify-between">
            <span className="truncate text-[15px] leading-5 font-medium" style={{ color: C.head }}>{t}</span>
            <I className="size-4 shrink-0" style={{ color: TYPES[k].color }} />
          </div>
          <div className="relative mt-[9px] line-clamp-2 text-[13px] leading-[18px]" style={{ color: C.muted }}>{b}</div>
        </div>
      ) })}
      <span className="absolute right-4 bottom-[64px] flex size-12 items-center justify-center rounded-full shadow-lg" style={{ background: C.blue }}><PlusIcon weight="bold" className="size-6 text-white" /></span>
    </div>
  )
}

function Side() {
  const Row = ({ icon: I, label, n, active, color, tap }: { icon: typeof TrayIcon; label: string; n?: number; active?: boolean; color?: string; tap?: boolean }) => (
    <div className="relative flex h-8 items-center gap-2.5 rounded-lg px-2.5 text-[14px]" style={active ? { background: "#dfe6f4", color: C.blue, fontWeight: 500 } : undefined}>
      {tap && <span className="m-sidetap absolute inset-0 rounded-lg bg-[#ebeae7]" />}
      <I weight={active ? "fill" : "regular"} className="relative size-[17px]" style={{ color: active ? C.blue : color ?? C.ink }} />
      <span className="relative flex-1">{label}</span>
      {n !== undefined && <span className="relative min-w-6 rounded-full px-1.5 text-center text-[11px] leading-[18px]" style={active ? { background: C.blue, color: "#fff" } : { color: C.faint }}>{n}</span>}
    </div>
  )
  const Head = ({ l, eye }: { l: string; eye?: boolean }) => (
    <div className="mt-3 flex h-7 items-center gap-1.5 px-3 text-[11px] font-medium tracking-[0.08em] uppercase" style={{ color: C.faint }}>
      <CaretDownIcon className="size-3" />{l}<span className="ml-auto flex gap-3">{eye && <EyeIcon className="size-3.5" />}<PlusIcon className="size-3.5" /></span>
    </div>
  )
  return (
    <div className="m-side absolute inset-y-0 left-0 w-[262px] px-1.5" style={{ background: "#f7f6f3", borderRight: `1px solid ${C.rule}` }}>
      <div className="flex h-[52px] items-center justify-between px-2.5 text-[15px] font-medium" style={{ color: C.head }}>{VAULT}<CaretDownIcon className="size-4" style={{ color: C.muted }} /></div>
      <Row icon={TrayIcon} label="Inbox" n={12} active />
      <Row icon={FileTextIcon} label="All Notes" n={3712} />
      <Row icon={ArchiveIcon} label="Archive" n={0} />
      <Head l="Views" />
      <Row icon={FunnelSimpleIcon} label="Start here!" n={16} />
      <Head l="Types" eye />
      <Row icon={TYPES.project.icon} label="Projects" n={TYPES.project.n} color={TYPES.project.color} tap />
      {(["essay", "evergreen", "reading", "person", "idea"] as const).map((k) => <Row key={k} icon={TYPES[k].icon} label={TYPES[k].label} n={TYPES[k].n} color={TYPES[k].color} />)}
      <Head l="Folders" />
      <div className="pl-4"><Row icon={FolderIcon} label="attachments" /><Row icon={FolderIcon} label="views" /></div>
      <div className="absolute inset-x-1.5 bottom-[30px] flex gap-2">
        <div className="flex h-10 flex-1 items-center gap-2 rounded-full bg-[#ebeae7] px-3 text-[11px] leading-[13px]" style={{ color: C.ink }}><ArrowsClockwiseIcon className="size-4" style={{ color: C.muted }} /><span>Local only<br /><span style={{ color: C.faint }}>Not linked</span></span></div>
        <span className="flex size-10 items-center justify-center rounded-full bg-[#ebeae7]"><CommandIcon className="size-[18px]" /></span>
        <span className="flex size-10 items-center justify-center rounded-full bg-[#ebeae7]"><GearSixIcon className="size-[18px]" /></span>
      </div>
    </div>
  )
}

const TASKS: [string, [string, string?], string][] = [
  ["Read the", ["Tolaria Principles"], "understand the core philosophy"],
  ["Explore the", ["tolaria-sidebar"], "learn Inbox, All Notes, Archive, Favorites, Types, Folders"],
  ["Browse the", ["tolaria-note-list"], "sorting, display properties, search within list"],
  ["Try the", ["Editor", "editor-playground"], "rich vs raw mode, callouts, blocks, code, highlights, whiteboards, PDF export, and collapsible sections"],
]
const Link = ({ t }: { t: string }) => <span className="whitespace-nowrap" style={{ color: C.blue }}><FileTextIcon className="mr-0.5 inline size-[15px] -translate-y-px" /><span className="underline decoration-dotted decoration-1 underline-offset-[5px]">{t}</span></span>

function Note() {
  return (
    <div className="m-note absolute inset-0 bg-white shadow-[-12px_0_32px_rgba(0,0,0,0.08)]">
      <div className="flex h-[52px] items-center gap-2 px-4" style={{ borderBottom: `1px solid ${C.rule}` }}>
        <WrenchIcon className="size-[18px] shrink-0" style={{ color: TYPES.project.color }} /><span className="flex-1 truncate text-[15px] font-medium" style={{ color: C.head }}>get-familiar-with-tolaria.md</span>
        <span className="flex items-center gap-4" style={{ color: C.muted }}><StarIcon className="size-[18px]" /><CodeIcon className="size-[18px]" /><DotsThreeIcon weight="bold" className="size-[18px]" /></span>
      </div>
      <div className="px-6 pt-6 text-[16px] leading-[23px]">
        <div className="text-[28px] leading-[36px] font-bold" style={{ color: C.head }}>Get familiar with Tolaria</div>
        <div className="mt-4 h-px" style={{ background: C.rule }} />
        <p className="mt-4">Use this checklist as a 15–20 minute tour of Tolaria. Every link opens a real file you can inspect, edit, and restore with Git.</p>
        <p className="mt-2"><code className="rounded bg-[#efefed] px-1 font-mono text-[14px]">Cmd+click</code> on wikilinks to navigate 👇</p>
        <div className="mt-2 flex flex-col gap-2 pl-6">
          {TASKS.map(([a, ls, b], i) => (
            <div key={a + ls[0]} className="flex items-start gap-2.5">
              <span className="relative mt-[3px] size-[17px] shrink-0 rounded-[5px] border-[1.5px]" style={{ borderColor: "#9b9a97" }}>
                {i === 0 && <span className="m-c1 absolute -inset-[1.5px] flex items-center justify-center rounded-[5px]" style={{ background: C.blue }}><CheckIcon weight="bold" className="size-3 text-white" /></span>}
              </span>
              <span className={i === 0 ? "m-t1" : ""}><b className="font-semibold" style={{ color: C.head }}>{a}</b> <Link t={ls[0]} />{ls[1] && <> and <Link t={ls[1]} /></>} — {b}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="absolute inset-x-0 bottom-0 flex h-[82px] items-start gap-1 bg-white px-4 pt-3" style={{ borderTop: `1px solid ${C.rule}`, color: C.muted }}>
        {[TextBIcon, TextItalicIcon, LinkSimpleIcon, TextHIcon].map((I, i) => <span key={i} className="flex size-10 items-center justify-center"><I className="size-5" /></span>)}
        <span className="flex size-10 items-center justify-center rounded-lg bg-[#eef2fd]" style={{ color: C.blue }}><ListBulletsIcon className="size-5" /></span>
        <span className="ml-auto flex size-10 items-center justify-center"><PlusIcon className="size-5" /></span>
        <span className="flex size-10 items-center justify-center"><DotsThreeIcon className="size-5" /></span>
      </div>
    </div>
  )
}

function Recreation() {
  return (
    <div role="img" aria-label="Illustration of Tolaria on iPhone: the Inbox, the sidebar, the Projects list, then the Get familiar with Tolaria checklist" className="mw loop absolute inset-0 text-[15px] leading-[22px]">
      <div aria-hidden className="absolute inset-0">
        <StatusBar />
        <div className="absolute inset-x-0 top-[54px] bottom-0 overflow-hidden">
          <Side />
          <div className="m-list absolute inset-0">
            <List title="Projects" rows={PROJECTS} project className="m-proj" />
            <List title="Inbox" rows={INBOX} className="m-inbox" />
          </div>
          <Note />
        </div>
        <div className="absolute bottom-2 left-1/2 z-20 h-[5px] w-[140px] -translate-x-1/2 rounded-full bg-black" />
      </div>
    </div>
  )
}

// The Peel's iPhone: the same Essay as the Mac and the .md file (mock-notes.tsx), on the phone.
function EssayNote() {
  const I = TYPES.essay.icon
  return (
    <div className="absolute inset-0 bg-white">
      <div className="flex h-[52px] items-center gap-2 px-4" style={{ borderBottom: `1px solid ${C.rule}` }}>
        <I className="size-[18px] shrink-0" style={{ color: TYPES.essay.color }} /><span className="flex-1 truncate text-[15px] font-medium" style={{ color: C.head }}>{ESSAY.file}</span>
        <span className="flex items-center gap-4" style={{ color: C.muted }}><StarIcon className="size-[18px]" /><CodeIcon className="size-[18px]" /><DotsThreeIcon weight="bold" className="size-[18px]" /></span>
      </div>
      <div className="px-6 pt-6 text-[16px] leading-[23px]">
        <div className="text-[28px] leading-[36px] font-bold" style={{ color: C.head }}>{ESSAY.title}</div>
        <div className="mt-2 flex gap-1.5 text-[13px] leading-5"><TypeChip k="essay" /><span className="rounded-[0.3em] px-[0.45em]" style={{ background: "var(--color-yellow-50)", color: "var(--color-yellow-700)" }}>Draft</span></div>
        <div className="mt-4 h-px" style={{ background: C.rule }} />
        <p className="mt-4">{ESSAY.lede}</p>
        <div className="mt-4 text-[15px]"><NoteTable /></div>
        <div className="mt-3 text-[14px]"><MermaidFlow /></div>
        <div className="mt-3 text-[15px]"><CodeBlock /></div>
      </div>
      <div className="absolute inset-x-0 bottom-0 flex h-[82px] items-start gap-1 bg-white px-4 pt-3" style={{ borderTop: `1px solid ${C.rule}`, color: C.muted }}>
        {[TextBIcon, TextItalicIcon, LinkSimpleIcon, TextHIcon, ListBulletsIcon].map((I, i) => <span key={i} className="flex size-10 items-center justify-center"><I className="size-5" /></span>)}
        <span className="ml-auto flex size-10 items-center justify-center"><PlusIcon className="size-5" /></span>
        <span className="flex size-10 items-center justify-center"><DotsThreeIcon className="size-5" /></span>
      </div>
    </div>
  )
}

function NoteScreen() {
  return (
    <div role="img" aria-label={`Illustration of Tolaria on iPhone showing the ${ESSAY.title} essay, with its table, diagram and code`} className="absolute inset-0 text-[15px] leading-[22px]">
      <div aria-hidden className="absolute inset-0">
        <StatusBar />
        <div className="absolute inset-x-0 top-[54px] bottom-0 overflow-hidden"><EssayNote /></div>
        <div className="absolute bottom-2 left-1/2 z-20 h-[5px] w-[140px] -translate-x-1/2 rounded-full bg-black" />
      </div>
    </div>
  )
}

function StatusBar() {
  return (
    <div className="absolute inset-x-0 top-0 z-10 flex h-[54px] items-center justify-between bg-white px-9 pt-1 text-[17px] font-semibold" style={{ color: "#000" }}>
      <span className="w-[60px] text-center">09:41</span>
      <span className="flex items-center gap-1.5"><CellSignalFullIcon weight="fill" className="size-[18px]" /><WifiHighIcon weight="bold" className="size-[18px]" /><BatteryFullIcon weight="fill" className="size-[26px]" /></span>
    </div>
  )
}
