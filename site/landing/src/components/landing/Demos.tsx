import {
  CaretRightIcon, CheckCircleIcon, CircleHalfIcon, ClockCounterClockwiseIcon, FileTextIcon, GitCommitIcon, MoonIcon,
  SparkleIcon, SunIcon, TagIcon, WrenchIcon,
} from "@phosphor-icons/react"

// One small looping story per feature card (8s, motion.css .fx-*). HTML/CSS recreations of the relevant bit of Tolaria's UI.
// Each demo is decorative (aria-hidden); the card's heading and text carry the meaning.
const Frame = ({ className = "", children }: { className?: string; children: React.ReactNode }) => (
  <div aria-hidden className={`fx loop relative h-60 overflow-hidden rounded-xl bg-app-tint p-4 text-[13px] leading-5 text-neutral-700 ${className}`}>{children}</div>
)
const Win = ({ className = "", children }: { className?: string; children: React.ReactNode }) => (
  <div className={`relative h-full overflow-hidden rounded-lg border border-black/5 bg-white shadow-sm ${className}`}>{children}</div>
)

export function EditorDemo() {
  // A Markdown table filled in place: a new row is typed (with a wikilink in a cell), its status pops in,
  // then the toggle flips to the raw Markdown the note is saved as.
  const rows: [string, string][] = [["Read principles", "Principles"], ["Explore sidebar", "Sidebar"]]
  const raw = ["| Step | Note | Status |", "| --- | --- | --- |", "| Read principles | [[Principles]] | done |", "| Explore sidebar | [[Sidebar]] | done |", "| Try the editor | [[Editor]] | done |"]
  const Done = () => <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-1.5 text-[11px] leading-[18px] text-emerald-700"><CheckCircleIcon weight="fill" className="size-3" />Done</span>
  const cell = "truncate px-2 py-1.5"
  return (
    <Frame className="fx-editor">
      <div className="absolute top-4 left-1/2 z-10 flex -translate-x-1/2 rounded-lg bg-white p-0.5 text-[12px] font-medium shadow-sm">
        <span className="thumb absolute inset-y-0.5 left-0.5 w-[calc(50%-2px)] rounded-md bg-app-light" />
        <span className="lbl-a relative w-20 py-1 text-center text-app-ink">Editor</span>
        <span className="lbl-b relative w-20 py-1 text-center text-app-ink">Markdown</span>
      </div>
      <Win className="mt-10 h-[calc(100%-40px)]">
        <div className="rendered absolute inset-0 px-4 pt-3">
          <div className="text-[15px] font-bold text-neutral-900">Tour progress</div>
          <div className="mt-2 overflow-hidden rounded-md border border-neutral-200 text-[12px]">
            <div className="grid grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_5.25rem] bg-neutral-50 font-semibold text-neutral-500"><span className={cell}>Step</span><span className={cell}>Note</span><span className="px-2 py-1.5 pr-3">Status</span></div>
            {rows.map(([t, n]) => (
              <div key={t} className="grid grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_5.25rem] border-t border-neutral-200 text-neutral-800"><span className={cell}>{t}</span><span className={`${cell} text-primary`}>{n}</span><span className="px-2 py-1.5 pr-3"><Done /></span></div>
            ))}
            <div className="new-row grid grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_5.25rem] border-t border-neutral-200 text-neutral-800">
              <span className={cell}><span className="typed c1" style={{ ["--mask" as string]: "#fff" }}>Try the editor<span className="mask" /><span className="track"><span className="cw absolute inset-y-0 right-0 w-0"><span className="caret" /></span></span></span></span>
              <span className={`${cell} text-primary`}><span className="typed c2" style={{ ["--mask" as string]: "#fff" }}>Editor<span className="mask" /><span className="track"><span className="cw absolute inset-y-0 right-0 w-0"><span className="caret" /></span></span></span></span>
              <span className="px-2 py-1.5 pr-3"><span className="chip-pop inline-block origin-left"><Done /></span></span>
            </div>
          </div>
        </div>
        <div className="raw absolute inset-0 bg-neutral-50" />
        <div className="absolute inset-0 px-4 pt-3 font-mono text-[10.5px] leading-[22px] text-neutral-600">
          <div className="raw-line text-neutral-900" style={{ ["--i" as string]: 0 }}># Tour progress</div>
          {raw.map((t, i) => <div key={i} className={`raw-line truncate ${i === raw.length - 1 ? "rounded bg-app-tint text-app-ink" : ""}`} style={{ ["--i" as string]: i + 1 }}>{t}</div>)}
        </div>
      </Win>
    </Frame>
  )
}

export function RelationsDemo() {
  const chips = ["Tolaria Principles", "Sidebar", "Note List"]
  return (
    <Frame className="fx-rel">
      <Win className="p-4 pt-3">
        <div className="mb-2 flex items-center gap-2 border-b border-neutral-100 pb-2">
          <WrenchIcon weight="fill" className="size-4 text-red-400" /><span className="truncate font-heading font-bold text-neutral-900">Get familiar with Tolaria</span>
          <span className="ml-auto rounded bg-red-50 px-1.5 text-[11px] text-red-700">Project</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-[12px] font-semibold text-neutral-500">Related</span>
          <span className="relative h-5 w-6 text-right text-[12px] text-neutral-400"><span className="count-a absolute inset-0">2</span><span className="count-b absolute inset-0">3</span></span>
        </div>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {chips.map((c, i) => (
            <div key={c} className="chip flex items-center gap-1.5 rounded-lg bg-emerald-50 px-2 py-1 text-[13px] text-emerald-800" style={{ ["--i" as string]: i }}>
              <FileTextIcon weight="fill" className="size-4 text-emerald-500" /><span className="truncate">{c}</span>
            </div>
          ))}
        </div>
        <div className="backlink mt-3 flex w-fit items-center gap-2 rounded-lg border border-dashed border-primary/40 px-2 py-1 text-[12px] text-app-ink">
          <TagIcon weight="fill" className="size-4" />Topic <b className="font-semibold">Tolaria</b>
        </div>
      </Win>
    </Frame>
  )
}

export function GitDemo() {
  const rows = ["get-familiar-with-tolaria.md", "tolaria-editor.md", "tolaria-ai.md"]
  const hist: [string, string, string, string][] = [["Updated 3 notes", "just now", "+4", "-2"], ["docs: refresh getting started", "Oct 13", "+1", "-11"], ["fix: use supported call", "Oct 9", "+0", "-1"], ["docs: refresh getting started", "Jul 23", "+2", "-8"]]
  return (
    <Frame className="fx-git">
      <div className="grid h-full grid-cols-2 gap-3">
        <Win className="p-3">
          <div className="flex items-center justify-between text-[12px] font-semibold text-neutral-900">
            Changes<span className="count flex size-5 items-center justify-center rounded-full bg-orange-500 text-[11px] text-white">3</span>
          </div>
          <div className="relative mt-2">
            {rows.map((r, i) => (
              <div key={r} className="row flex h-7 items-center gap-2 text-[12px]" style={{ ["--i" as string]: i }}>
                <span className="font-mono font-semibold text-orange-500">M</span><span className="truncate">{r}</span>
              </div>
            ))}
            <div className="clean absolute inset-x-0 top-6 flex flex-col items-center gap-1 text-center text-[12px] text-neutral-500">
              <CheckCircleIcon weight="fill" className="size-6 text-emerald-500" />Synced just now
            </div>
          </div>
          <div className="btn absolute right-3 bottom-3 left-3 flex h-8 items-center justify-center gap-1 rounded-md bg-primary text-[12px] font-semibold text-white">
            <GitCommitIcon weight="bold" className="size-4" />Commit and push
          </div>
        </Win>
        <Win className="p-3">
          <div className="flex items-center gap-1 text-[12px] font-semibold text-neutral-900"><ClockCounterClockwiseIcon className="size-4 text-primary" />History</div>
          <div className="hist mt-2">
            {hist.map(([m, t, add, del], i) => (
              <div key={m + t} className={`flex h-12 items-center gap-2 text-[12px] ${i === 0 ? "hist-new" : ""}`}>
                <GitCommitIcon className={`size-4 shrink-0 ${i === 0 ? "text-primary" : "text-neutral-400"}`} />
                <div className="min-w-0"><div className="truncate font-medium text-neutral-800">{m}</div><div className="text-[11px] text-neutral-400">{t} <span className="text-emerald-600">{add}</span> <span className="text-orange-600">{del}</span></div></div>
              </div>
            ))}
          </div>
        </Win>
      </div>
    </Frame>
  )
}

export function AiDemo() {
  // Illustration modelled on Karn's staged capture (screens/2026-10-26-ai-panel-skills.png); not a real transcript.
  const tools: [string, number][] = [["Skill", 0], ["Glob", 1], ["Read", 2]]
  return (
    <Frame className="fx-ai">
      <Win className="flex flex-col p-3 pt-2">
        <span className="text-[10px] font-semibold tracking-wide text-neutral-400 uppercase">Illustration</span>
        <div className="ask -mt-1 ml-auto whitespace-nowrap rounded-xl bg-neutral-100 px-3 py-1 text-[12px] text-neutral-800">Run daily-digest on today's notes</div>
        <div className="skill mt-1.5 flex items-center gap-1 text-[11px] text-neutral-500"><CaretRightIcon className="size-3" />Tool use<span className="rounded bg-neutral-100 px-1">3</span></div>
        <div className="mt-1 flex gap-1">
          {tools.map(([t, i]) => (
            <div key={t} className="ans flex h-6 min-w-0 items-center gap-1 rounded-md bg-app-tint px-2 text-[12px] text-neutral-700" style={{ ["--i" as string]: i }}>
              {t}<CheckCircleIcon weight="fill" className="size-3.5 shrink-0 text-emerald-500" />
            </div>
          ))}
        </div>
        <p className="edited mt-2 truncate text-[12px] leading-4 text-neutral-700">Digest ready. I linked it from <span className="rounded bg-app-tint px-1 text-app-ink">Editor</span>.</p>
        <div className="mt-auto flex shrink-0 items-center gap-2 rounded-lg border border-neutral-200 px-2 py-1 text-[11px] text-neutral-400">
          <SparkleIcon weight="fill" className="size-3.5 text-orange-500" />Claude<span className="ml-1 rounded bg-neutral-100 px-1 text-neutral-500">Vault Safe</span><span className="ml-auto">Ask Claude Code</span>
        </div>
      </Win>
    </Frame>
  )
}

export function ThemeDemo() {
  // Settings, Appearance: Light -> Dark -> Hybrid (dark sidebar, light note), then back to Light.
  // Colours from Karn's 2026-10-26 light-main, dark-main and hybrid-main captures.
  const rows = ["Inbox", "All Notes", "Archive", "People", "Projects"]
  const Side = ({ dark }: { dark?: boolean }) => (
    <div className={`absolute inset-y-0 left-0 w-[38%] p-3 ${dark ? "side-dark bg-[#191814] text-[#b8b1a6]" : "border-r border-[#e9e9e7] bg-[#f7f6f3] text-[#37352f]"}`}>
      <div className="mb-2 flex gap-1"><span className="size-2 rounded-full bg-[#ff5f57]" /><span className="size-2 rounded-full bg-[#febc2e]" /><span className="size-2 rounded-full bg-[#28c840]" /></div>
      {rows.map((r, i) => (
        <div key={r} className={`flex h-6 items-center gap-1.5 truncate rounded px-1 text-[12px] ${i === 1 ? (dark ? "bg-[#22262b] text-[#8fb0ff]" : "bg-[#dfe6f4] text-[#2c5cf6]") : ""}`}>
          <FileTextIcon weight="fill" className="size-3.5 shrink-0 opacity-70" />{r}
        </div>
      ))}
    </div>
  )
  const Note = ({ dark }: { dark?: boolean }) => (
    <div className={`absolute inset-y-0 right-0 left-[38%] p-4 ${dark ? "main-dark bg-[#1f1e1b]" : "bg-white"}`}>
      <div className={`text-base font-bold ${dark ? "text-[#f1ece3]" : "text-[#37352f]"}`}>Make It Yours</div>
      <p className={`mt-1 text-[12px] ${dark ? "text-[#b8b1a6]" : "text-[#787774]"}`}>A few settings change how Tolaria looks and feels: theme, language, note width, and layout.</p>
    </div>
  )
  return (
    <Frame className="fx-theme">
      <div className="absolute top-4 left-1/2 z-10 flex -translate-x-1/2 rounded-lg bg-white p-0.5 text-[12px] font-medium shadow-sm">
        <span className="thumb absolute inset-y-0.5 left-0.5 w-[calc(33.333%-1.33px)] rounded-md bg-app-light" />
        <span className="relative flex w-[72px] items-center justify-center gap-1 py-1 text-app-ink"><SunIcon weight="fill" className="size-3.5" />Light</span>
        <span className="relative flex w-[72px] items-center justify-center gap-1 py-1 text-app-ink"><MoonIcon weight="fill" className="size-3.5" />Dark</span>
        <span className="relative flex w-[72px] items-center justify-center gap-1 py-1 text-app-ink"><CircleHalfIcon weight="fill" className="size-3.5" />Hybrid</span>
      </div>
      <Win className="mt-10 h-[calc(100%-40px)]">
        <Note /><Note dark /><Side /><Side dark />
      </Win>
    </Frame>
  )
}
