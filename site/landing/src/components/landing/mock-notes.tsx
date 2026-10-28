import {
  ArrowsClockwiseIcon, BookOpenIcon, CalendarBlankIcon, EyeglassesIcon, GearIcon, LeafIcon, LightbulbIcon, MicrophoneIcon,
  PaintBrushIcon, RobotIcon, TagIcon, ToolboxIcon, UsersIcon, WrenchIcon, NotebookIcon, MegaphoneIcon,
} from "@phosphor-icons/react"

// Shared data for the device mock-ups (MacBook, iPhone, Peel to Markdown): note types with their colour and icon,
// modelled on a real Tolaria vault's sidebar, and the rich "From notes to essays" note (table, Mermaid, code) with
// the raw Markdown it is stored as. Colours are the Refactoring brand palette (CSS vars from brand/shadcn.css).
// Written out in full (not built from a template) so Tailwind's scanner keeps every one of these theme variables.
const HUES = {
  red: ["var(--color-red-500)", "var(--color-red-50)", "var(--color-red-700)"],
  purple: ["var(--color-purple-500)", "var(--color-purple-50)", "var(--color-purple-700)"],
  blue: ["var(--color-blue-500)", "var(--color-blue-50)", "var(--color-blue-700)"],
  green: ["var(--color-green-500)", "var(--color-green-50)", "var(--color-green-700)"],
  orange: ["var(--color-orange-500)", "var(--color-orange-50)", "var(--color-orange-700)"],
  yellow: ["var(--color-yellow-600)", "var(--color-yellow-50)", "var(--color-yellow-700)"],
} as const
type Hue = keyof typeof HUES
const T = (label: string, one: string, icon: typeof TagIcon, hue: Hue, n: number) => ({ label, one, icon, hue, n, color: HUES[hue][0], tint: HUES[hue][1], deep: HUES[hue][2] })

export const TYPES = {
  project: T("Projects", "Project", WrenchIcon, "red", 5),
  responsibility: T("Responsibilities", "Responsibility", GearIcon, "purple", 13),
  operation: T("Operations", "Operation", ArrowsClockwiseIcon, "purple", 37),
  essay: T("Essays", "Essay", PaintBrushIcon, "blue", 438),
  interview: T("Interviews", "Interview", MicrophoneIcon, "blue", 79),
  evergreen: T("Evergreen Notes", "Evergreen Note", LeafIcon, "green", 1138),
  topic: T("Topics", "Topic", TagIcon, "green", 24),
  reading: T("Readings", "Reading", BookOpenIcon, "orange", 560),
  digest: T("Digests", "Digest", EyeglassesIcon, "orange", 30),
  event: T("Events", "Event", CalendarBlankIcon, "orange", 517),
  journal: T("Journals", "Journal", NotebookIcon, "yellow", 6),
  person: T("People", "Person", UsersIcon, "yellow", 478),
  idea: T("Monday Ideas", "Monday Idea", LightbulbIcon, "blue", 228),
  release: T("Release Notes", "Release Note", MegaphoneIcon, "blue", 19),
  agent: T("Agents", "Agent", RobotIcon, "purple", 11),
  skill: T("Skills", "Skill", ToolboxIcon, "orange", 9),
} as const
export type TypeKey = keyof typeof TYPES
export const VAULT = "Refactoring"

// ---------- the rich note ----------
export const ESSAY = {
  title: "From notes to essays",
  file: "from-notes-to-essays.md",
  slug: "from-notes-to-essays",
  lede: "Every essay starts as scattered notes. Here is the pipeline I use to turn them into something worth publishing.",
}
export const TABLE = [["Stage", "Where", "Output"], ["Capture", "Inbox", "Raw notes"], ["Distill", "Evergreen notes", "Ideas"], ["Publish", "Essays", "Newsletter"]]
const FLOW = ["Readings", "Evergreen notes", "Essay"]

// Raw file, line by line: [className, text]. Mirrors exactly what <EssayBlocks> renders.
const fm = "text-neutral-400", key = "text-purple-600", pipe = "text-neutral-400", fence = "text-neutral-400"
export const ESSAY_RAW: [string, string][] = [
  [fm, "---"], [key, "type: Essay"], [key, "status: Draft"], [fm, "---"],
  ["font-semibold text-neutral-900", `# ${ESSAY.title}`], ["", ""],
  [pipe, "| Stage   | Where           | Output     |"], [pipe, "| ------- | --------------- | ---------- |"],
  ["", "| Capture | Inbox           | Raw notes  |"], ["", "| Distill | Evergreen notes | Ideas      |"], ["", "| Publish | Essays          | Newsletter |"], ["", ""],
  [fence, "```mermaid"], ["", "flowchart LR"], ["", "  R[Readings] --> E[Evergreen notes] --> P[Essay]"], [fence, "```"], ["", ""],
  [fence, "```ts"], ["", "const drafts = notes.filter((n) => n.status === \"Draft\")"], ["", "drafts.sort((a, b) => b.modified - a.modified)"], [fence, "```"],
]

// Everything below is sized in em, so one font-size on the wrapper scales a block for the Mac, the peel or the phone.
const R = "#e9e9e7"
export function NoteTable() {
  return (
    <table className="w-full table-fixed border-separate border-spacing-0 overflow-hidden rounded-[0.4em] text-[0.87em] leading-[1.5]" style={{ border: `1px solid ${R}` }}>
      <tbody>
        {TABLE.map((row, i) => (
          <tr key={i} style={i === 0 ? { background: "#f7f6f3" } : undefined}>
            {row.map((c, j) => (
              <td key={j} className={`truncate px-[0.7em] py-[0.3em] ${i === 0 ? "font-semibold" : ""}`} style={{ borderTop: i ? `1px solid ${R}` : undefined, borderLeft: j ? `1px solid ${R}` : undefined, color: i === 0 ? "#2f2d27" : undefined }}>{c}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  )
}

// A static Mermaid flowchart in Mermaid's default theme (lavender nodes, dark arrows): no runtime, crisp at any scale.
export function MermaidFlow() {
  return (
    <div className="flex items-center justify-center rounded-[0.4em] px-[0.8em] py-[1em] text-[0.8em] leading-none" style={{ border: `1px solid ${R}`, background: "#fcfcfb", color: "#333" }}>
      {FLOW.map((n, i) => (
        <span key={n} className="flex items-center">
          {i > 0 && (
            <svg viewBox="0 0 40 10" className="mx-[0.25em] h-[0.7em] w-[2.6em] shrink-0" aria-hidden>
              <path d="M0 5H35" stroke="#333" strokeWidth="1.4" /><path d="M33 1.5 39.5 5 33 8.5Z" fill="#333" />
            </svg>
          )}
          <span className="rounded-[0.3em] px-[0.85em] py-[0.6em] whitespace-nowrap" style={{ background: "#ececff", border: "1px solid #9370db" }}>{n}</span>
        </span>
      ))}
    </div>
  )
}

const K = { kw: "var(--color-purple-600)", fn: "var(--color-blue-600)", str: "var(--color-green-700)", op: "#787774" }
const S = ({ c, children }: { c: string; children: React.ReactNode }) => <span style={{ color: c }}>{children}</span>
export function CodeBlock() {
  return (
    <div className="relative overflow-hidden rounded-[0.4em] px-[0.9em] py-[0.7em] font-mono text-[0.8em] leading-[1.65] whitespace-pre" style={{ background: "#f7f6f3", color: "#37352f" }}>
      <span className="absolute top-[0.5em] right-[0.8em] font-sans text-[0.85em]" style={{ color: "#9b9a97" }}>TypeScript</span>
      <div><S c={K.kw}>const</S> drafts <S c={K.op}>=</S> notes.<S c={K.fn}>filter</S>((n) <S c={K.kw}>=&gt;</S> n.status <S c={K.op}>===</S> <S c={K.str}>"Draft"</S>)</div>
      <div>drafts.<S c={K.fn}>sort</S>((a, b) <S c={K.kw}>=&gt;</S> b.modified <S c={K.op}>-</S> a.modified)</div>
    </div>
  )
}

export function TypeChip({ k, className = "" }: { k: TypeKey; className?: string }) {
  const t = TYPES[k], I = t.icon
  return <span className={`inline-flex items-center gap-[0.3em] rounded-[0.3em] px-[0.45em] ${className}`} style={{ background: t.tint, color: t.deep }}><I weight="fill" className="size-[1em]" />{t.one}</span>
}
