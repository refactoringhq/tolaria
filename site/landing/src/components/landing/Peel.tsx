import { useEffect, useRef } from "react"
import { CaretRightIcon, CodeIcon, DotsThreeIcon, FileTextIcon, GitCommitIcon, StarIcon } from "@phosphor-icons/react"
import { ESSAY, ESSAY_RAW, NoteTable, MermaidFlow, CodeBlock, TypeChip } from "./mock-notes"
import { PhoneWindow } from "./PhoneWindow"

// Signature moment, "Peel to Markdown" (feedback/r5-spec.md): a short pinned stage under the hero. The rendered note
// splits down the middle and parts to show the same note as its .md file, a "Committed" chip rises, and the iPhone
// slides in on the same note. Scroll writes --a/--b/--c (0..1) on the stage; CSS turns them into transforms/opacity.
// Below 768px or under reduced motion there is no pinning: the three steps render as a static row/stack.
const C = { rule: "#e9e9e7", ink: "#37352f", head: "#2f2d27", muted: "#787774", faint: "#9b9a97", blue: "#2c5cf6" }
const STEPS = [
  ["Write in a real editor", "Tables, diagrams, code, wikilinks and properties, with no export step."],
  ["It's a plain Markdown file", "YAML frontmatter on top, your words below. Open it in any editor or grep it."],
  ["Git takes it everywhere", "Commit and push from the app, then open the same note on your iPhone."],
] as const
const RUN = 1200
const MOTION = "(min-width: 768px) and (prefers-reduced-motion: no-preference)"
const ease = (t: number) => 1 - (1 - t) ** 3
const seg = (p: number, a: number, b: number) => ease(Math.min(1, Math.max(0, (p - a) / (b - a))))

export function Peel() {
  const runway = useRef<HTMLDivElement>(null)
  const stage = useRef<HTMLDivElement>(null)
  const label = useRef<HTMLSpanElement>(null)
  useEffect(() => {
    // Review aid (website-motion recipe 16): ?p=0.6 freezes the stage at that progress for screenshots.
    const fixed = new URLSearchParams(location.search).get("p")
    let resolved = false
    const mq = matchMedia(MOTION)
    let raf = 0
    const update = () => {
      raf = 0
      // The stage is only as tall as its content and pins centred in the viewport (top = T), so the section starts
      // right after the showcase instead of after half a screen of empty sticky box. Pinned for exactly RUN px.
      const h = stage.current!.offsetHeight, T = Math.max(88, (innerHeight - h) / 2)
      const st = stage.current!.style
      st.top = `${T}px`; runway.current!.style.height = `${h + RUN}px`
      const r = runway.current!.getBoundingClientRect()
      const p = fixed !== null ? Math.min(1, Math.max(0, +fixed || 0)) : Math.min(1, Math.max(0, (T - r.top) / RUN))
      const a = seg(p, 0.12, 0.45), b = seg(p, 0.45, 0.6), c = seg(p, 0.6, 0.88)
      st.setProperty("--a", a.toFixed(4)); st.setProperty("--b", b.toFixed(4)); st.setProperty("--c", c.toFixed(4))
      stage.current!.dataset.step = String(c > 0.5 ? 3 : a > 0.5 ? 2 : 1)
      if (b > 0.3 && !resolved) { resolved = true; glyph(label.current!) }
    }
    const onScroll = () => { if (!raf) raf = requestAnimationFrame(update) }
    const bind = () => {
      removeEventListener("scroll", onScroll); removeEventListener("resize", onScroll)
      if (!mq.matches) return
      addEventListener("scroll", onScroll, { passive: true }); addEventListener("resize", onScroll, { passive: true }); update()
    }
    bind(); mq.addEventListener("change", bind)
    return () => { mq.removeEventListener("change", bind); removeEventListener("scroll", onScroll); removeEventListener("resize", onScroll); cancelAnimationFrame(raf) }
  }, [])

  return (
    <section id="peel" aria-labelledby="peel-h" className="mx-auto max-w-6xl px-4 pt-24 sm:px-6 sm:pt-28">
      {/* pinned version (md+, motion allowed) */}
      <div ref={runway} className="hidden overflow-x-clip md:motion-safe:block" style={{ height: "calc(100dvh + 1200px)" }}>
        <div ref={stage} data-step="1" className="peel sticky top-[88px] flex items-center" style={{ ["--a" as string]: 0, ["--b" as string]: 0, ["--c" as string]: 0 }}>
          <div className="grid w-full items-center gap-8 lg:grid-cols-[minmax(0,4fr)_minmax(0,8fr)] lg:gap-12">
            <div>
              <Head />
              <ol className="mt-6 grid gap-3 md:grid-cols-3 lg:grid-cols-1">
                {STEPS.map(([t, b], i) => (
                  <li key={t} data-n={i + 1} className="peel-step rounded-2xl border bg-card p-4 transition-opacity duration-300 ease-out-weighted">
                    <span className="flex items-center gap-2 font-heading text-base font-bold"><Num n={i + 1} />{t}</span>
                    <p className="mt-1 text-sm text-pretty text-muted-foreground">{b}</p>
                  </li>
                ))}
              </ol>
            </div>
            <div className="relative mx-auto aspect-[16/11] w-full overflow-clip rounded-3xl bg-app-tint max-w-[min(760px,calc(52dvh*16/11))] lg:max-w-[min(760px,calc(70dvh*16/11))]" aria-hidden>
              <div className="peel-raw absolute inset-[5%_14%_6%_5%] origin-center"><RawFile /></div>
              {/* at rest one whole card (same radius, border and shadow as the .md card); the two halves take over only
                  once peeling starts, so there is no seam or square corner at p=0. Each half's shadow is a drop-shadow on
                  an unclipped wrapper, because clip-path would cut a box-shadow off. */}
              <div className="peel-whole absolute inset-[6%_14%_10%_5%] overflow-hidden rounded-2xl border shadow-sm"><Rendered /></div>
              <div className="peel-l absolute inset-[6%_14%_10%_5%]"><div className="size-full overflow-hidden rounded-2xl border [clip-path:inset(-1px_50%_-1px_-1px)]"><Rendered /></div></div>
              <div className="peel-r absolute inset-[6%_14%_10%_5%]"><div className="size-full overflow-hidden rounded-2xl border [clip-path:inset(-1px_-1px_-1px_50%)]"><Rendered /></div></div>
              <div className="peel-chip absolute bottom-[3%] left-[7%] z-10"><Chip labelRef={label} /></div>
              <PhoneWindow screen="note" className="peel-phone absolute right-[3%] -bottom-[18%] z-20 w-[25%]" />
            </div>
          </div>
        </div>
      </div>
      {/* static version (phones, reduced motion) */}
      <div className="md:motion-safe:hidden">
        <Head />
        {/* below 768px: a swipeable scroll-snap rail (website-motion recipe 11) so the steps don't add three screens */}
        <ol aria-label="Three steps" tabIndex={0} className="-mx-4 mt-8 flex snap-x snap-mandatory scroll-px-4 gap-3 overflow-x-auto px-4 pb-2 outline-none [scrollbar-width:none] focus-visible:ring-3 focus-visible:ring-ring/50 md:mx-0 md:grid md:grid-cols-3 md:gap-4 md:overflow-visible md:px-0">
          {STEPS.map(([t, b], i) => (
            <li key={t} className="reveal flex w-[85%] shrink-0 snap-start flex-col rounded-2xl border bg-card p-2 md:w-auto" style={{ ["--i" as string]: i }}>
              <div aria-hidden className="relative h-64 overflow-hidden rounded-xl bg-app-tint p-4">
                {i === 0 && <div className="h-full overflow-hidden rounded-xl shadow-sm"><Rendered small /></div>}
                {i === 1 && <RawFile small />}
                {i === 2 && <div className="flex h-full items-start justify-center"><PhoneWindow screen="note" className="w-[132px]" /></div>}
              </div>
              <div className="p-4">
                <span className="flex items-center gap-2 font-heading text-lg font-bold"><Num n={i + 1} />{t}</span>
                <p className="mt-1 text-base text-pretty text-muted-foreground">{b}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}

function Head() {
  return (
    <div className="max-lg:text-center">
      <p className="text-sm font-semibold text-app-ink">Under the hood</p>
      <h2 id="peel-h" className="mt-2 font-display text-4xl text-balance sm:text-5xl">One note, three places</h2>
    </div>
  )
}
const Num = ({ n }: { n: number }) => <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">{n}</span>

// The rendered half and the .md half show the same note: the Essay the hero window ends on (mock-notes.tsx).
function Rendered({ small = false }: { small?: boolean }) {
  return (
    <div className="flex size-full flex-col bg-white text-left" style={{ color: C.ink }}>
      <div className="flex h-10 shrink-0 items-center gap-2 px-4 text-[12px]" style={{ borderBottom: `1px solid ${C.rule}`, background: "#f7f6f3" }}>
        <span className="size-2.5 rounded-full bg-[#ff5f57]" /><span className="size-2.5 rounded-full bg-[#febc2e]" /><span className="size-2.5 rounded-full bg-[#28c840]" />
        <span className="ml-3 flex min-w-0 items-center gap-1.5 truncate"><span style={{ color: C.muted }}>Essay</span><CaretRightIcon className="size-3" style={{ color: C.faint }} /><span className="truncate font-medium" style={{ color: C.head }}>{ESSAY.slug}</span></span>
        {!small && <span className="ml-auto flex items-center gap-3" style={{ color: C.muted }}><StarIcon className="size-4" /><CodeIcon className="size-4" /><DotsThreeIcon className="size-4" /></span>}
      </div>
      <div className={small ? "p-4 text-[11px]" : "px-[8%] pt-[5%] text-[clamp(11px,1vw,14px)]"}>
        <div className={`${small ? "text-lg leading-6" : "text-[clamp(20px,2.3vw,30px)] leading-tight"} font-bold`} style={{ color: C.head }}>{ESSAY.title}</div>
        <div className="mt-2 flex gap-1.5 text-[11px] leading-[18px]"><TypeChip k="essay" /><span className="rounded-[0.3em] px-[0.45em]" style={{ background: "var(--color-yellow-50)", color: "var(--color-yellow-700)" }}>Draft</span></div>
        <div className="mt-3 h-px" style={{ background: C.rule }} />
        <div className="mt-3"><NoteTable /></div>
        <div className="mt-[0.8em]"><MermaidFlow /></div>
        {!small && <div className="mt-[0.8em]"><CodeBlock /></div>}
      </div>
    </div>
  )
}

function RawFile({ small = false }: { small?: boolean }) {
  return (
    <div className="flex size-full flex-col overflow-hidden rounded-2xl border bg-card shadow-sm">
      <div className="flex h-10 shrink-0 items-center gap-2 border-b bg-muted px-4 font-mono text-[12px] text-muted-foreground">
        <FileTextIcon weight="fill" className="size-4 text-app" />{ESSAY.file}
      </div>
      <div className={`min-h-0 flex-1 overflow-hidden px-4 py-3 font-mono text-neutral-700 ${small ? "text-[10px] leading-[15px]" : "text-[clamp(10px,0.9vw,12.5px)] leading-[1.5]"}`}>
        {ESSAY_RAW.map(([c, t], i) => <div key={i} className={`truncate whitespace-pre ${c}`}>{t || "\u00a0"}</div>)}
      </div>
    </div>
  )
}

// Glyph resolve (website-motion recipe 17): the filename settles from mono glyphs into its text, left to right, once.
const FILE = ESSAY.file
function glyph(el: HTMLElement, ms = 700) {
  const pool = "#*/-_=+<>[]01", t0 = performance.now()
  const step = (now: number) => {
    const k = Math.min(1, (now - t0) / ms), n = Math.floor(k * FILE.length)
    el.textContent = FILE.slice(0, n) + [...FILE.slice(n)].map(() => pool[(Math.random() * pool.length) | 0]).join("")
    if (k < 1) requestAnimationFrame(step)
  }
  requestAnimationFrame(step)
}
function Chip({ labelRef }: { labelRef?: React.Ref<HTMLSpanElement> }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full border bg-card py-1.5 pr-4 pl-1.5 text-sm font-semibold whitespace-nowrap shadow-lg">
      <span className="flex size-7 items-center justify-center rounded-full bg-[#2fa36b] text-white"><GitCommitIcon weight="fill" className="size-4" /></span>
      Committed<span className="font-normal text-muted-foreground"><span ref={labelRef} className="inline-block font-mono text-xs" style={{ minWidth: `${FILE.length}ch` }}>{FILE}</span> · main</span>
    </span>
  )
}
