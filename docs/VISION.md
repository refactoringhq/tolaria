# Laputa — Product Vision

*Written by Brian based on conversations with Luca Rossi, Feb–Mar 2026.*
*This is a living document — update it as the vision evolves.*

---

## Why this, why now, why us

Before the what and how: the why.

The best projects are built by people who have an unusually strong answer to "why are you the right person to build this?" This is that answer.

**Luca Rossi** is a startup founder and former generalist CTO — someone who can build a product end-to-end across code, design, scope, and product. And for the last five years, full-time, he has run Refactoring: a technical newsletter with nearly 200,000 subscribers, for which he has written over 300 original articles. In word count, that's roughly two *Lord of the Rings* novels.

Personal knowledge management has been an obsession since university. But over the last five years it stopped being a hobby and became *table stakes* — the system that makes writing 300 articles possible. Laputa is an attempt to bottle that system.

The credibility is real: if you wonder whether this person knows how to organize knowledge for sustained output, the output speaks for itself. The method inside Laputa is not theorized — it's been battle-tested for years at scale.

**The distribution is built in.** Refactoring reaches ~200,000 engineers, managers, and technical leaders — exactly the people most receptive to a tool like this. The audience already trusts the author on this topic, because they've been reading his writing about knowledge management and learning for years.

This is not a product looking for a market. It's a tool built by its first power user, for an audience that already knows and trusts him.

---

## The problem

Most people who want to work effectively with AI face a version of the same problem: **they don't have their knowledge organized in a way that AI can actually use.**

They have notes scattered across Notion, Apple Notes, browser bookmarks, and email. Some of it is structured, most of it isn't. Even the people who do maintain a knowledge base discover that AI tools — ChatGPT, Notion AI, others — struggle to navigate it meaningfully. The knowledge is there, but it's not *accessible*.

The problem has two distinct layers:

1. **Architectural**: most knowledge tools store data in proprietary formats on remote servers. AI tools can't read them efficiently, can't commit changes back, can't reason over the full structure. The format itself creates a ceiling.

2. **Methodological**: even with the right tool, most people don't know *how* to organize knowledge so it becomes useful over time — what to capture, how to connect things, how to turn raw notes into a system that works with you instead of against you.

Laputa addresses both layers, together. That's what makes it different.

---

## The insight: tool and method, together

Most PKM tools give you a blank canvas and leave the rest to you. They solve the first problem (somewhere to put things) but not the second (how to organize them). The result is that sophisticated users build complex custom systems, while everyone else gives up.

Laputa's position is different: **we ship the method alongside the tool.**

The method is opinionated but not rigid. It tells you: here's how to think about your work, here's where different kinds of notes belong, here's how to connect them. If it fits your needs — great, start immediately. If your situation is different — customize it. The types, the relationships, the structure can all be changed. But you don't have to figure it out from scratch.

This combination — an opinionated method on top of a technically excellent foundation — is what makes Laputa genuinely useful to people who are stuck, not just people who already know what they're doing.

---

## The method: a framework for knowledge work

### The knowledge ontology

Laputa organizes work around two axes:

|  | **One-time** | **Recurring** |
|---|---|---|
| **Multi-session** | **Project** (has a start and end) | **Responsibility** (no end, measured by KPIs) |
| **Single-session** | *Task* (lives in a task manager) | **Procedure** (checklist, routine) |

Everything else is context:
- **Notes** — the atomic unit. Any note connects to one or more of the above.
- **Topics** — areas of interest with no performance expectation. A knowledge repository.
- **Events** — things that happened, anchored to a date.
- **People** — contacts and their history.

Relations between notes are first-class citizens — not just wiki-links, but typed, bidirectional connections that make the knowledge graph navigable.

This ontology is not arbitrary. It maps cleanly to how both individuals and organizations actually structure their work: companies have projects, responsibilities, procedures, and people. So do independent creators. So do individuals managing their lives.

### Knowledge has a purpose

A principle that underlies everything in Laputa: **notes exist to get things done.** Not to be stored for some abstract future use. Not to show how organized you are. To do something.

This is the difference between a knowledge system that works over years and one that collapses after a few weeks. Without a real purpose, the maintenance cost of taking notes is never justified, and people stop. With a purpose — writing regularly, building things, making decisions — the system pays for itself.

What you *do* with organized knowledge depends on who you are:

- **Writers and content creators** — the output is articles, essays, posts. Captures become highlights, highlights become **evergreen notes** (small, atomic, timeless ideas), evergreen notes become building blocks for articles. Evergreen notes are a middle layer: not the raw input, not the final output, but the refined reusable units that make writing easier and faster.
- **Builders and project-driven people** — the output is shipped work. Captures feed projects, decisions, and procedures. Evergreen notes matter less; the project knowledge graph matters more.
- **Operators and managers** — the output is better systems and decisions. Captures feed responsibilities (KPIs, workflows) and procedures (how we do things). The value accumulates in the recurring structure, not in individual notes.

The framework is flexible enough to fit all three — and most people are a mix. What stays constant is the flow: **capture → organize → express**. The *what* of expressing changes; the discipline doesn't.

### The two-phase workflow: capture and organize

Notes move through two distinct phases, and the transition between them is intentional.

**Capture** — fast, frictionless, available everywhere. A thought, a saved article, a Kindle highlight, a voice memo. The cardinal rule: never let friction during capture cause a good idea to be lost. Captured notes land in the vault unconnected — no relationships, no organization. That's fine. That's the point.

**Organize** — a deliberate, periodic activity (weekly is the natural cadence). You ask: *what is this useful for?* Many things that seemed important when captured won't survive this question — deleting >50% of captures is normal and healthy. For the things that survive: connect them. Link to a Project, a Responsibility, a Topic. Every note should eventually connect to at least one actionable container. If you can't connect something to anything, that's a signal worth paying attention to.

**The Inbox** is the UI expression of this split: a smart section that shows all unorganized notes — those with no outgoing relationships. The goal is Inbox Zero, reached periodically (weekly). The inbox is not a folder; it's a derived state. Connecting a note to something removes it automatically.

### Convention over configuration

The method lives in the app as *conventions*: standard field names and folder structures that have well-defined meanings and trigger specific behavior.

`status:` shows a colored chip. `Workspace: [[workspace/refactoring]]` assigns a note to a context. `Belongs to:` connects it to its parent. `start_date:` and `end_date:` show a duration badge. The app recognizes these by convention, without any setup.

Users who want more can override the defaults: `config/relations.md` changes which relationship fields appear by default; `config/semantic-properties.md` controls how fields are rendered. But the defaults work immediately, for everyone.

This is convention *over* configuration — not convention *instead of* it.

---

## The foundation: architecture that earns trust

The method is only as good as the system it runs on. Laputa's architecture is built around a single principle: **your knowledge is yours, permanently and unconditionally.**

### Local files, version-controlled with Git

Every note is a plain Markdown file on your disk. There is no database, no proprietary format, no sync lock-in. The files are readable by any tool that can open a text file — today and in twenty years.

Git provides version control: every change is tracked, diffable, reversible. You have a full audit trail of what changed, when, and why. Collaboration happens via Git — the same way software teams have collaborated for decades, without any proprietary cloud in between.

### AI-native by design

A vault of plain Markdown files, version-controlled with Git, is dramatically more AI-friendly than any SaaS-based system.

An AI agent working on a local vault can read thousands of notes in seconds, understand their structure, write new ones, connect existing ones, and commit the changes back — all with full comprehension. Notion's AI can't do this. No SaaS-based AI can do this, because the architecture doesn't allow it.

More importantly: the more a vault follows Laputa's conventions, the *less configuration an AI needs* to navigate it. Shared conventions make knowledge legible to both humans and AI without bespoke instructions for every setup. The method and the AI-native architecture reinforce each other.

### Open and exit-friendly

The trust between Laputa and the user is earned daily, not enforced by format. If something better comes along, you take your Markdown files and leave. The exit door is always open.

---

## Why not Obsidian?

Obsidian is the obvious comparison. The difference is philosophy:

- **Obsidian** is a blank canvas. Infinitely configurable via plugins and community extensions. Powerful for users who want to build their own system — and who have the time and patience to do so.
- **Laputa** is opinionated. It ships with a complete point of view: a knowledge framework, semantic conventions, and defaults that work immediately. No plugin hunting. No configuration required to get started.

Obsidian also treats Git as an afterthought — its business model is built around proprietary sync. In Laputa, Git is a first-class citizen: the natural, obvious way to sync, collaborate, and maintain history.

---

## Who it's for, and where it's going

### Three stages of adoption

Laputa is designed to grow through three natural stages — not pivots, but extensions of the same foundation:

**Stage 1: Personal PKM + AI context** *(current)*
A single person manages their knowledge, life, and work in a local vault. The primary collaborator is AI. The vault gives structure to one person's context, making it legible to an AI that can assist meaningfully across all areas of work and life. The method helps structure the knowledge; the AI helps use it.

**Stage 2: Independent knowledge workers**
Content creators, freelancers, consultants. People with maximum incentive *and* maximum agency to build a real system. They have projects, clients, responsibilities — and they work alone or in very small teams. The same ontology applies: a newsletter creator has editorial projects, a subscriber-growth responsibility, and a publishing procedure. AI collaboration deepens: the AI can see not just personal notes but client commitments, content pipelines, recurring workflows.

**Stage 3: Small teams**
The ontology scales to organizations. Companies have projects, responsibilities, procedures, and people — the same categories, at a larger scale. The access model changes: different people see different subsets of the vault, via workspace filtering and Git-based access control. Version history gives teams a full audit trail. AI agents become shared collaborators on team knowledge, not just personal assistants.

**What makes this trajectory coherent:** the foundational model — local files, Git-versioned, structured by conventions — doesn't need to be rebuilt at each stage. It extends naturally.

### The right early adopters

The first users who will get the most from Laputa are technically-minded individuals who:
- Are frustrated with Notion's performance, complexity, or lock-in
- Understand or are comfortable with Git
- Want a system that's AI-native by design, not by bolted-on features
- Value owning their data

Broader audiences will follow as the onboarding experience matures and the conventions become easier to adopt.

---

## Current state

A living snapshot of what's built. Updated as features ship.

### ✅ Working today

- BlockNote editor with Markdown files on disk; Cmd+S save; dirty state indicator
- 4-panel layout: sidebar / note list / editor / inspector
- Tabs with drag-to-reorder; quick open (Cmd+P); virtual list (handles 9000+ notes)
- `type:` as canonical frontmatter field; inspector with editable properties
- Bidirectional relationships; editable relation chips; wikilink autocomplete (`[[`)
- Sidebar sections with custom icons and colors
- Git integration: commit & push, version history per note, dirty state tracking
- Dynamic vault picker; create or clone vaults from GitHub
- GitHub OAuth (device flow); AI chat panel; Claude CLI agent panel
- Auto-updater; universal macOS binary; CI with coverage gates

### 🚧 Ahead (consolidation sprint → features)

**Consolidation sprint (current):**
Fixing architectural foundations before building further — cache model, type field canonicalization, allContent removal, hardcoded paths.

**Next features:**
Inbox section, semantic properties (status chips, progress indicators), default relationships in properties panel, workspace filter, mobile apps (iPhone for capture, iPad as desktop mirror).

*For the full roadmap, see [ROADMAP.md](./ROADMAP.md).*

---

## Design principles

1. **Opinionated but not rigid** — ship the method and the defaults; allow customization where it matters
2. **Convention over configuration** — standard field names trigger rich behavior automatically; users can override via vault config files
3. **Git-first** — sync, history, collaboration, and audit trail via Git; no proprietary cloud
4. **AI-native architecture** — local files, open formats, structured by conventions legible to both humans and AI
5. **Zero lock-in** — earn trust daily; the exit door is always open
6. **Capture and organize are separate** — the inbox makes unorganized notes visible; Inbox Zero is the discipline
7. **Relations as first-class citizens** — connections between notes are as important as the notes themselves
8. **Filesystem as the single source of truth** — the app never owns the data; cache and UI state are always derived and reconstructible
