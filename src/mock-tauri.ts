/**
 * Mock Tauri invoke for browser testing.
 * When running outside Tauri (e.g. in Chrome via localhost:5173),
 * this provides realistic test data so the UI can be verified visually.
 */

import type { VaultEntry, GitCommit, ModifiedFile, Settings, DeviceFlowStart, DeviceFlowPollResult, GitHubUser } from './types'

// --- Vault API detection (for reading real files in browser dev mode) ---
let vaultApiAvailable: boolean | null = null

async function checkVaultApi(): Promise<boolean> {
  if (vaultApiAvailable !== null) return vaultApiAvailable
  try {
    const res = await fetch('/api/vault/ping', { signal: AbortSignal.timeout(500) })
    vaultApiAvailable = res.ok
  } catch {
    vaultApiAvailable = false
  }
  console.info(`[mock-tauri] Vault API available: ${vaultApiAvailable}`)
  return vaultApiAvailable
}

const MOCK_CONTENT: Record<string, string> = {
  '/Users/luca/Laputa/project/26q1-laputa-app.md': `---
title: Build Laputa App
type: Project
status: Active
owner: Luca Rossi
tags: [Tauri, React, TypeScript, CodeMirror]
tools: [Vite, Vitest, Playwright]
url: https://github.com/lucaong/laputa-app
belongs_to:
  - "[[quarter/q1-2026]]"
related_to:
  - "[[topic/software-development]]"
---

# Build Laputa App

## Text Formatting
This paragraph has **bold text**, *italic text*, ***bold italic***, ~~strikethrough~~, and \`inline code\`. Here's a [regular link](https://example.com) and a wiki-link to [[Matteo Cellini]].

## Headings

### Third Level Heading
Content under H3.

#### Fourth Level Heading
Content under H4.

## Lists

### Bullet Lists (Nested)
- First level item — this is a top-level bullet point
  - Second level item — indented one level
    - Third level item — indented two levels
    - Another third level item with longer text that wraps to multiple lines to test alignment
  - Back to second level
- Another first level item
  - With a nested child
- Final first level item

### Numbered Lists
1. Step one — do this first
2. Step two — then do this
3. Step three — finally this
   1. Sub-step 3a
   2. Sub-step 3b

### Checkboxes
- [x] Completed task with strikethrough
- [x] Another done item
- [ ] Pending task — needs attention
- [ ] Future task with **bold** text inside

### Mixed Nesting
- Top level bullet
  - Nested bullet
    - Deep nested bullet
  - Back to second
- Another top level
  - With child

## Block Quotes
> This is a blockquote. It should have a left border and distinct styling.
> It can span multiple lines and contain **formatting**.

## Code Blocks
\`\`\`typescript
interface VaultEntry {
  path: string;
  title: string;
  isA: string;
  status: string | null;
}

function loadVault(path: string): VaultEntry[] {
  // Load all markdown files from the vault
  return entries.filter(e => e.isA !== 'Note');
}
\`\`\`

\`\`\`yaml
title: Some Title
type: Project
status: Active
\`\`\`

## Tables
| Feature | Status | Priority |
|---------|--------|----------|
| Editor | Done | High |
| Inspector | Done | High |
| Git Integration | Done | Medium |
| Mobile App | Planned | Low |

## Horizontal Rule

---

## Wiki-Links
See [[Stock Screener — EMA200 Wick Bounce]] for the experiment approach.
Contact [[Matteo Cellini]] for sponsorship data.
Link to [[Grow Newsletter]] responsibility.
Check [[Software Development]] for tech notes.
See [[Laputa App Design Session]] event recap.
Read [[Write Weekly Essays]] procedure.
Also see [[Non-Existent Note]] which is a broken link.

## Paragraphs & Spacing
This is a normal paragraph with enough text to test line wrapping and spacing between elements. The paragraph should have comfortable line height and spacing from the heading above.

And this is a second paragraph to verify inter-paragraph spacing is correct. Good typography requires consistent vertical rhythm throughout the document.
`,
  '/Users/luca/Laputa/responsibility/grow-newsletter.md': `---
title: Grow Newsletter
type: Responsibility
status: Active
owner: Luca Rossi
---

# Grow Newsletter

## Purpose
Build a sustainable audience through high-quality weekly essays on **engineering leadership**, **AI**, and **personal systems**.

## Key Metrics
- Subscriber count (target: 100k by Q2 2026)
- Open rate (target: > 50%)
- Click-through rate

## Current Strategy
1. Publish one essay per week — Tuesday morning
2. Promote via Twitter/X threads
3. Cross-post to LinkedIn with native formatting
4. Guest posts on other newsletters monthly

## Procedures
- [[Write Weekly Essays]] — the core writing workflow
- Monthly audience analysis and topic planning

## Notes
The newsletter is the *engine* that drives everything else — sponsorships, consulting leads, and brand building.
`,
  '/Users/luca/Laputa/responsibility/manage-sponsorships.md': `---
title: Manage Sponsorships
type: Responsibility
status: Active
owner: Matteo Cellini
---

# Manage Sponsorships

## Overview
Revenue stream from newsletter sponsorships. [[Matteo Cellini]] handles day-to-day operations.

## Process
1. Inbound leads via sponsorship page
2. Qualification call
3. Proposal and negotiation
4. Schedule and deliver
5. Report results to sponsor

## Metrics
- Monthly revenue
- Close rate
- Repeat sponsor rate
`,
  '/Users/luca/Laputa/procedure/write-weekly-essays.md': `---
title: Write Weekly Essays
type: Procedure
status: Active
owner: Luca Rossi
cadence: Weekly
belongs_to:
  - "[[responsibility/grow-newsletter]]"
---

# Write Weekly Essays

## Schedule
- **Monday**: Pick topic, outline
- **Tuesday**: First draft
- **Wednesday**: Edit and polish
- **Thursday**: Schedule for Tuesday send

## Writing Guidelines
- 1500-2500 words
- One clear takeaway
- Use *real examples* from personal experience
- Include actionable advice, not just theory

### Checklist
- [ ] Pick a topic from the backlog
- [ ] Write outline with 3-5 sections
- [x] Set up newsletter template
- [x] Configure email scheduling
- [ ] Review analytics from last issue

### Nested Topics
- Content strategy for growing the newsletter audience through organic channels, referrals, and high-quality evergreen content that people want to share with their engineering teams
  - Newsletter growth and subscriber acquisition including all the different channels we use to attract new readers to the publication
    - Organic subscribers from search, Twitter, and word of mouth — these are the highest quality subscribers with the best retention rates over time
    - Paid acquisition through Facebook ads and newsletter cross-promotions with other engineering publications in the space
  - Social media cross-posting
- Technical writing
  - Code examples
  - Architecture diagrams
1. First ordered item with a really long description that should definitely wrap to the next line when displayed in the editor, testing the hanging indent behavior for numbered lists
2. Second ordered item — shorter
  1. Nested ordered item that also has quite a long description to verify that the indentation works correctly for nested numbered lists too
`,
  '/Users/luca/Laputa/procedure/run-sponsorships.md': `---
title: Run Sponsorships
type: Procedure
status: Active
owner: Matteo Cellini
cadence: Weekly
belongs_to:
  - "[[responsibility/manage-sponsorships]]"
---

# Run Sponsorships

## Weekly Tasks
- Review pipeline in CRM
- Follow up with pending proposals
- Schedule confirmed sponsors
- Send performance reports to completed sponsors

## Templates
- Proposal template: \`/templates/sponsorship-proposal.md\`
- Report template: \`/templates/sponsorship-report.md\`
`,
  '/Users/luca/Laputa/experiment/stock-screener.md': `---
title: Stock Screener — EMA200 Wick Bounce
type: Experiment
status: Active
owner: Luca Rossi
domains: [Finance, Quantitative Analysis]
tools: [Python, pandas, TradingView]
related_to:
  - "[[topic/trading]]"
  - "[[topic/algorithmic-trading]]"
---

# Stock Screener — EMA200 Wick Bounce

## Hypothesis
Stocks that wick below the 200-day EMA and close above it show a **statistically significant bounce** in the following 5-10 days.

## Setup
- Scan for daily candles where:
  - Low < EMA200
  - Close > EMA200
  - Volume > 1.5x average
- Filter for mid-cap stocks ($2B-$20B)

## Results So Far
| Date | Ticker | Entry | Exit | Return |
|------|--------|-------|------|--------|
| 2026-01-15 | AAPL | 182.30 | 189.50 | +3.9% |
| 2026-01-22 | MSFT | 410.20 | 418.80 | +2.1% |

## Next Steps
- [ ] Backtest on 10 years of data
- [ ] Add RSI filter for oversold confirmation
- [ ] Build automated alerts via Python script
`,
  '/Users/luca/Laputa/note/facebook-ads-strategy.md': `---
title: Facebook Ads Strategy
type: Note
belongs_to:
  - "[[project/26q1-laputa-app]]"
related_to:
  - "[[topic/growth]]"
  - "[[topic/ads]]"
---

# Facebook Ads Strategy

## Key Learnings
- **Lookalike audiences** from newsletter subscribers convert 3x better than interest-based targeting
- Video ads outperform static images by 40% on engagement
- Best performing CTA: "Join 50,000 engineers" (social proof)

## Budget
- Monthly budget: $2,000
- Cost per subscriber: ~$1.50 (down from $3.20 in Q3 2025)

## A/B Tests Running
1. Long-form vs short-form ad copy
2. Testimonial vs data-driven creative
`,
  '/Users/luca/Laputa/note/budget-allocation.md': `---
title: Budget Allocation
type: Note
belongs_to:
  - "[[project/26q1-laputa-app]]"
---

# Budget Allocation

## Q1 2026
| Category | Budget | Actual | Delta |
|----------|--------|--------|-------|
| Ads | $6,000 | $5,400 | -$600 |
| Tools | $500 | $480 | -$20 |
| Freelancers | $2,000 | $1,800 | -$200 |

## Notes
- Under budget on ads due to improved targeting efficiency
- Consider reallocating savings to content production
`,
  '/Users/luca/Laputa/person/matteo-cellini.md': `---
title: Matteo Cellini
type: Person
aliases:
  - Matteo
---

# Matteo Cellini

## Role
Sponsorship manager — handles all sponsor relationships, proposals, and reporting.

## Contact
- Email: matteo@example.com
- Slack: @matteo

## Responsibilities
- [[Manage Sponsorships]]
- [[Run Sponsorships]]
`,
  '/Users/luca/Laputa/event/2026-02-14-laputa-app-kickoff.md': `---
title: Laputa App Design Session
type: Event
related_to:
  - "[[project/26q1-laputa-app]]"
  - "[[person/matteo-cellini]]"
---

# Laputa App Design Session

## Date
2026-02-14

## Attendees
- Luca Rossi
- [[Matteo Cellini]]

## Notes
- Agreed on four-panel layout inspired by Bear Notes
- CodeMirror 6 for the editor — live preview is critical
- MVP by end of Q1: sidebar + note list + editor working
- Inspector panel can wait for M4

## Action Items
- [ ] Luca: finalize ontology mapping
- [x] Luca: set up Tauri v2 project scaffold
- [ ] Matteo: test with real vault data
`,
  '/Users/luca/Laputa/topic/software-development.md': `---
title: Software Development
type: Topic
aliases:
  - Dev
  - Coding
---

# Software Development

A broad topic covering everything from frontend to systems programming.

## Subtopics of Interest
- **Frontend**: React, TypeScript, CSS
- **Desktop**: Tauri, Electron alternatives
- **AI/ML**: LLMs, agents, code generation
- **Systems**: Rust, performance optimization
`,
  '/Users/luca/Laputa/topic/trading.md': `---
title: Trading
type: Topic
aliases:
  - Algorithmic Trading
---

# Trading

## Focus Areas
- Technical analysis (EMA, RSI, volume patterns)
- Algorithmic screening and alerts
- Risk management and position sizing

## Active Experiments
- [[Stock Screener — EMA200 Wick Bounce]]
`,
  '/Users/luca/Laputa/essay/on-writing-well.md': `---
title: On Writing Well
type: Essay
Belongs to:
  - "[[responsibility/grow-newsletter]]"
---

# On Writing Well

Good writing is lean and confident. Every sentence should serve a purpose.
`,
  '/Users/luca/Laputa/essay/engineering-leadership-101.md': `---
title: Engineering Leadership 101
type: Essay
Belongs to:
  - "[[responsibility/grow-newsletter]]"
Related to:
  - "[[topic/software-development]]"
---

# Engineering Leadership 101

The transition from IC to manager is the hardest career shift in engineering.
`,
  '/Users/luca/Laputa/essay/ai-agents-primer.md': `---
title: AI Agents Primer
type: Essay
Belongs to:
  - "[[responsibility/grow-newsletter]]"
---

# AI Agents Primer

AI agents are autonomous systems that can plan, execute, and adapt to achieve goals.
`,
  // --- Type documents ---
  '/Users/luca/Laputa/type/project.md': `---
type: Type
order: 0
---

# Project

A **time-bound initiative** that advances a [[type/responsibility|Responsibility]]. Projects have a clear start, end, and deliverables.

## Properties
- **Status**: Active, Paused, Done, Dropped
- **Owner**: The person accountable
- **Belongs to**: Usually a Quarter or Responsibility
`,
  '/Users/luca/Laputa/type/responsibility.md': `---
type: Type
order: 1
---

# Responsibility

An **ongoing area of ownership** — something you're accountable for indefinitely. Responsibilities don't end; they have procedures, projects, and measures attached.

## Properties
- **Status**: Active, Paused, Archived
- **Owner**: The person accountable
`,
  '/Users/luca/Laputa/type/procedure.md': `---
type: Type
order: 2
---

# Procedure

A **recurring process** tied to a [[type/responsibility|Responsibility]]. Procedures have a cadence (weekly, monthly) and describe how to do something.

## Properties
- **Status**: Active, Paused
- **Owner**: The person responsible
- **Cadence**: Weekly, Monthly, Quarterly
- **Belongs to**: A Responsibility
`,
  '/Users/luca/Laputa/type/experiment.md': `---
type: Type
order: 3
---

# Experiment

A **hypothesis-driven investigation** with a clear test and measurable outcome. Experiments are time-bound and have explicit success criteria.

## Properties
- **Status**: Active, Done, Dropped
- **Owner**: The person running the experiment
`,
  '/Users/luca/Laputa/type/person.md': `---
type: Type
order: 4
---

# Person

A **person** you interact with — team members, collaborators, contacts. People can own projects, responsibilities, and procedures.

## Properties
- **Aliases**: Alternative names for wikilink resolution
`,
  '/Users/luca/Laputa/type/event.md': `---
type: Type
order: 5
---

# Event

A **point-in-time occurrence** — meetings, launches, milestones. Events are linked to the entities they relate to.

## Properties
- **Related to**: Entities this event is about
`,
  '/Users/luca/Laputa/type/topic.md': `---
type: Type
order: 6
---

# Topic

A **subject area** for categorization. Topics group related notes, projects, and resources by theme.

## Properties
- **Aliases**: Alternative names
`,
  '/Users/luca/Laputa/type/essay.md': `---
type: Type
order: 7
---

# Essay

A **published piece of writing** — newsletter essays, blog posts, articles. Essays belong to a responsibility and may relate to topics.

## Properties
- **Belongs to**: Usually a Responsibility
`,
  '/Users/luca/Laputa/type/note.md': `---
type: Type
order: 8
---

# Note

A **general-purpose document** — research notes, meeting notes, strategy docs. Notes belong to projects or responsibilities.

## Properties
- **Belongs to**: A Project, Responsibility, or other parent
`,
  // --- Custom type documents (user-created types) ---
  '/Users/luca/Laputa/type/recipe.md': `---
type: Type
icon: cooking-pot
color: orange
---

# Recipe

A **recipe** for cooking or baking. Recipes have ingredients, steps, and serving info.

## Default Properties
- **Servings**: Number of servings
- **Prep Time**: Time to prepare
- **Cook Time**: Time to cook
`,
  '/Users/luca/Laputa/type/book.md': `---
type: Type
icon: book-open
color: green
---

# Book

A **book** you're reading or have read. Track reading progress, notes, and key takeaways.

## Default Properties
- **Author**: The book's author
- **Status**: Reading, Finished, Abandoned
- **Rating**: 1-5 stars
`,
  // --- Trashed entries ---
  '/Users/luca/Laputa/note/old-draft-notes.md': `---
title: Old Draft Notes
type: Note
trashed: true
trashed_at: ${new Date(Date.now() - 86400000 * 5).toISOString().slice(0, 10)}
belongs_to:
  - "[[project/26q1-laputa-app]]"
---

# Old Draft Notes

Some rough draft content that is no longer relevant. Moving to trash.
`,
  '/Users/luca/Laputa/note/deprecated-api-notes.md': `---
title: Deprecated API Notes
type: Note
trashed: true
trashed_at: ${new Date(Date.now() - 86400000 * 35).toISOString().slice(0, 10)}
---

# Deprecated API Notes

Old API documentation for the v1 endpoint. Replaced by v2 docs.
`,
  '/Users/luca/Laputa/experiment/failed-seo-experiment.md': `---
title: Failed SEO Experiment
type: Experiment
status: Dropped
trashed: true
trashed_at: ${new Date(Date.now() - 86400000 * 10).toISOString().slice(0, 10)}
related_to:
  - "[[responsibility/grow-newsletter]]"
---

# Failed SEO Experiment

Tried programmatic SEO pages. Results were negligible — trashing this.
`,
  // --- Archived entries ---
  '/Users/luca/Laputa/project/25q3-website-redesign.md': `---
title: Website Redesign
type: Project
status: Done
archived: true
owner: Luca Rossi
belongs_to:
  - "[[quarter/q3-2025]]"
---

# Website Redesign

Completed redesign of the company website. Migrated from WordPress to Next.js with improved performance and SEO.

## Results
- Page load time: 4.2s → 1.1s
- Organic traffic: +35% in 3 months
- Bounce rate: 58% → 42%
`,
  '/Users/luca/Laputa/experiment/twitter-thread-experiment.md': `---
title: Twitter Thread Growth Experiment
type: Experiment
status: Done
archived: true
owner: Luca Rossi
related_to:
  - "[[responsibility/grow-newsletter]]"
---

# Twitter Thread Growth Experiment

## Hypothesis
Publishing 3 Twitter threads per week (instead of 1) will increase newsletter signups by 50%.

## Result
After 6 weeks, signups increased by only 12%. The additional threads had diminishing returns — quality matters more than quantity.

## Decision
Reverted to 1 high-quality thread per week. Archived this experiment.
`,
  // --- Instances of custom types ---
  '/Users/luca/Laputa/recipe/pasta-carbonara.md': `---
title: Pasta Carbonara
type: Recipe
servings: 4
prep_time: 10 min
cook_time: 20 min
---

# Pasta Carbonara

Classic Roman pasta dish with eggs, pecorino, guanciale, and black pepper.

## Ingredients
- 400g spaghetti
- 200g guanciale
- 4 egg yolks + 2 whole eggs
- 100g Pecorino Romano
- Black pepper
`,
  '/Users/luca/Laputa/book/designing-data-intensive-applications.md': `---
title: Designing Data-Intensive Applications
type: Book
author: Martin Kleppmann
status: Finished
rating: 5
---

# Designing Data-Intensive Applications

Essential reading for anyone building distributed systems. Covers replication, partitioning, transactions, and stream processing.
`,
}

const MOCK_ENTRIES: VaultEntry[] = [
  {
    path: '/Users/luca/Laputa/project/26q1-laputa-app.md',
    filename: '26q1-laputa-app.md',
    title: 'Build Laputa App',
    isA: 'Project',
    aliases: ['Laputa App'],
    belongsTo: ['[[quarter/q1-2026]]'],
    relatedTo: ['[[topic/software-development]]'],
    status: 'Active',
    owner: 'Luca Rossi',
    cadence: null,
    archived: false,
    trashed: false,
    trashedAt: null,
    modifiedAt: Date.now() / 1000,
    createdAt: Date.now() / 1000 - 86400 * 60,
    fileSize: 2048,
    snippet: 'This paragraph has bold text, italic text, bold italic, strikethrough, and inline code. Here\'s a regular link and a wiki-link to Matteo Cellini.',
    relationships: {
      'Belongs to': ['[[quarter/q1-2026]]'],
      'Related to': ['[[topic/software-development]]'],
      'Type': ['[[type/project]]'],
    },
    icon: null,
    color: null,
    order: null,
  },
  {
    path: '/Users/luca/Laputa/responsibility/grow-newsletter.md',
    filename: 'grow-newsletter.md',
    title: 'Grow Newsletter',
    isA: 'Responsibility',
    aliases: [],
    belongsTo: [],
    relatedTo: ['[[topic/growth]]'],
    status: 'Active',
    owner: 'Luca Rossi',
    cadence: null,
    archived: false,
    trashed: false,
    trashedAt: null,
    modifiedAt: Date.now() / 1000 - 3600,
    createdAt: Date.now() / 1000 - 86400 * 180,
    fileSize: 1024,
    snippet: 'Build a sustainable audience through high-quality weekly essays on engineering leadership, AI, and personal systems.',
    relationships: {
      'Has': [
        '[[essay/on-writing-well|On Writing Well]]',
        '[[essay/engineering-leadership-101|Engineering Leadership 101]]',
        '[[essay/ai-agents-primer|AI Agents Primer]]',
      ],
      'Topics': ['[[topic/growth]]', '[[topic/writing]]'],
      'Related to': ['[[topic/growth]]'],
      'Type': ['[[type/responsibility]]'],
    },
    icon: null,
    color: null,
    order: null,
  },
  {
    path: '/Users/luca/Laputa/responsibility/manage-sponsorships.md',
    filename: 'manage-sponsorships.md',
    title: 'Manage Sponsorships',
    isA: 'Responsibility',
    aliases: [],
    belongsTo: [],
    relatedTo: [],
    status: 'Active',
    owner: 'Matteo Cellini',
    cadence: null,
    archived: false,
    trashed: false,
    trashedAt: null,
    modifiedAt: Date.now() / 1000 - 7200,
    createdAt: Date.now() / 1000 - 86400 * 150,
    fileSize: 890,
    snippet: 'Revenue stream from newsletter sponsorships. Matteo Cellini handles day-to-day operations.',
    relationships: {
      'Owner': ['[[person/matteo-cellini|Matteo Cellini]]'],
      'Type': ['[[type/responsibility]]'],
    },
    icon: null,
    color: null,
    order: null,
  },
  {
    path: '/Users/luca/Laputa/procedure/write-weekly-essays.md',
    filename: 'write-weekly-essays.md',
    title: 'Write Weekly Essays',
    isA: 'Procedure',
    aliases: [],
    belongsTo: ['[[responsibility/grow-newsletter]]'],
    relatedTo: [],
    status: 'Paused',
    owner: 'Luca Rossi',
    cadence: 'Weekly',
    archived: false,
    trashed: false,
    trashedAt: null,
    modifiedAt: Date.now() / 1000 - 86400,
    createdAt: Date.now() / 1000 - 86400 * 120,
    fileSize: 512,
    snippet: 'Monday: Pick topic, outline Tuesday: First draft Wednesday: Edit and polish Thursday: Schedule for Tuesday send',
    relationships: {
      'Belongs to': ['[[responsibility/grow-newsletter]]'],
      'Type': ['[[type/procedure]]'],
    },
    icon: null,
    color: null,
    order: null,
  },
  {
    path: '/Users/luca/Laputa/procedure/run-sponsorships.md',
    filename: 'run-sponsorships.md',
    title: 'Run Sponsorships',
    isA: 'Procedure',
    aliases: [],
    belongsTo: ['[[responsibility/manage-sponsorships]]'],
    relatedTo: [],
    status: 'Done',
    owner: 'Matteo Cellini',
    cadence: 'Weekly',
    archived: false,
    trashed: false,
    trashedAt: null,
    modifiedAt: Date.now() / 1000 - 86400 * 2,
    createdAt: Date.now() / 1000 - 86400 * 100,
    fileSize: 640,
    snippet: 'Review pipeline in CRM Follow up with pending proposals Schedule confirmed sponsors Send performance reports to completed sponsors',
    relationships: {
      'Belongs to': ['[[responsibility/manage-sponsorships]]'],
      'Type': ['[[type/procedure]]'],
    },
    icon: null,
    color: null,
    order: null,
  },
  {
    path: '/Users/luca/Laputa/experiment/stock-screener.md',
    filename: 'stock-screener.md',
    title: 'Stock Screener — EMA200 Wick Bounce',
    isA: 'Experiment',
    aliases: ['Trading Screener'],
    belongsTo: [],
    relatedTo: ['[[topic/trading]]', '[[topic/algorithmic-trading]]'],
    status: 'Paused',
    owner: 'Luca Rossi',
    cadence: null,
    archived: false,
    trashed: false,
    trashedAt: null,
    modifiedAt: Date.now() / 1000 - 86400,
    createdAt: Date.now() / 1000 - 86400 * 45,
    fileSize: 3200,
    snippet: 'Stocks that wick below the 200-day EMA and close above it show a statistically significant bounce in the following 5-10 days.',
    relationships: {
      'Related to': ['[[topic/trading]]', '[[topic/algorithmic-trading]]'],
      'Has Data': ['[[data/ema200-backtest-results]]'],
      'Type': ['[[type/experiment]]'],
    },
    icon: null,
    color: null,
    order: null,
  },
  {
    path: '/Users/luca/Laputa/note/facebook-ads-strategy.md',
    filename: 'facebook-ads-strategy.md',
    title: 'Facebook Ads Strategy',
    isA: 'Note',
    aliases: [],
    belongsTo: ['[[project/26q1-laputa-app]]'],
    relatedTo: ['[[topic/growth]]', '[[topic/ads]]'],
    status: null,
    owner: null,
    cadence: null,
    archived: false,
    trashed: false,
    trashedAt: null,
    modifiedAt: Date.now() / 1000 - 3600 * 5,
    createdAt: Date.now() / 1000 - 86400 * 30,
    fileSize: 847,
    snippet: 'Lookalike audiences from newsletter subscribers convert 3x better than interest-based targeting Video ads outperform static images by 40% on engagement',
    relationships: {
      'Belongs to': ['[[project/26q1-laputa-app]]'],
      'Related to': ['[[topic/growth]]', '[[topic/ads]]'],
      'Type': ['[[type/note]]'],
    },
    icon: null,
    color: null,
    order: null,
  },
  {
    path: '/Users/luca/Laputa/note/budget-allocation.md',
    filename: 'budget-allocation.md',
    title: 'Budget Allocation',
    isA: 'Note',
    aliases: [],
    belongsTo: ['[[project/26q1-laputa-app]]'],
    relatedTo: [],
    status: null,
    owner: null,
    cadence: null,
    archived: false,
    trashed: false,
    trashedAt: null,
    modifiedAt: Date.now() / 1000 - 86400,
    createdAt: Date.now() / 1000 - 86400 * 20,
    fileSize: 560,
    snippet: 'Under budget on ads due to improved targeting efficiency Consider reallocating savings to content production',
    relationships: {
      'Belongs to': ['[[project/26q1-laputa-app]]'],
      'Type': ['[[type/note]]'],
    },
    icon: null,
    color: null,
    order: null,
  },
  {
    path: '/Users/luca/Laputa/person/matteo-cellini.md',
    filename: 'matteo-cellini.md',
    title: 'Matteo Cellini',
    isA: 'Person',
    aliases: ['Matteo'],
    belongsTo: [],
    relatedTo: [],
    status: null,
    owner: null,
    cadence: null,
    archived: false,
    trashed: false,
    trashedAt: null,
    modifiedAt: Date.now() / 1000 - 86400 * 7,
    createdAt: Date.now() / 1000 - 86400 * 200,
    fileSize: 320,
    snippet: 'Sponsorship manager — handles all sponsor relationships, proposals, and reporting.',
    relationships: {
      'Type': ['[[type/person]]'],
    },
    icon: null,
    color: null,
    order: null,
  },
  {
    path: '/Users/luca/Laputa/event/2026-02-14-laputa-app-kickoff.md',
    filename: '2026-02-14-laputa-app-kickoff.md',
    title: 'Laputa App Design Session',
    isA: 'Event',
    aliases: [],
    belongsTo: [],
    relatedTo: ['[[project/26q1-laputa-app]]', '[[person/matteo-cellini]]'],
    status: null,
    owner: null,
    cadence: null,
    archived: false,
    trashed: false,
    trashedAt: null,
    modifiedAt: Date.now() / 1000 - 3600 * 2,
    createdAt: Date.now() / 1000 - 86400 * 7,
    fileSize: 1200,
    snippet: 'Agreed on four-panel layout inspired by Bear Notes CodeMirror 6 for the editor — live preview is critical MVP by end of Q1.',
    relationships: {
      'Related to': ['[[project/26q1-laputa-app]]', '[[person/matteo-cellini]]'],
      'Type': ['[[type/event]]'],
    },
    icon: null,
    color: null,
    order: null,
  },
  {
    path: '/Users/luca/Laputa/topic/software-development.md',
    filename: 'software-development.md',
    title: 'Software Development',
    isA: 'Topic',
    aliases: ['Dev', 'Coding'],
    belongsTo: [],
    relatedTo: [],
    status: null,
    owner: null,
    cadence: null,
    archived: false,
    trashed: false,
    trashedAt: null,
    modifiedAt: Date.now() / 1000 - 86400 * 30,
    createdAt: Date.now() / 1000 - 86400 * 365,
    fileSize: 256,
    snippet: 'A broad topic covering everything from frontend to systems programming.',
    relationships: {
      'Notes': ['[[note/facebook-ads-strategy]]', '[[note/budget-allocation]]'],
      'Type': ['[[type/topic]]'],
    },
    icon: null,
    color: null,
    order: null,
  },
  {
    path: '/Users/luca/Laputa/topic/trading.md',
    filename: 'trading.md',
    title: 'Trading',
    isA: 'Topic',
    aliases: ['Algorithmic Trading'],
    belongsTo: [],
    relatedTo: [],
    status: null,
    owner: null,
    cadence: null,
    archived: false,
    trashed: false,
    trashedAt: null,
    modifiedAt: Date.now() / 1000 - 86400 * 14,
    createdAt: Date.now() / 1000 - 86400 * 300,
    fileSize: 180,
    snippet: 'Technical analysis (EMA, RSI, volume patterns) Algorithmic screening and alerts Risk management and position sizing',
    relationships: {
      'Notes': ['[[experiment/stock-screener]]'],
      'Type': ['[[type/topic]]'],
    },
    icon: null,
    color: null,
    order: null,
  },
  {
    path: '/Users/luca/Laputa/essay/on-writing-well.md',
    filename: 'on-writing-well.md',
    title: 'On Writing Well',
    isA: 'Essay',
    aliases: [],
    belongsTo: ['[[responsibility/grow-newsletter]]'],
    relatedTo: [],
    status: null,
    owner: null,
    cadence: null,
    archived: false,
    trashed: false,
    trashedAt: null,
    modifiedAt: Date.now() / 1000 - 86400 * 3,
    createdAt: Date.now() / 1000 - 86400 * 14,
    fileSize: 4200,
    snippet: 'Good writing is lean and confident. Every sentence should serve a purpose.',
    relationships: {
      'Belongs to': ['[[responsibility/grow-newsletter]]'],
      'Type': ['[[type/essay]]'],
    },
    icon: null,
    color: null,
    order: null,
  },
  {
    path: '/Users/luca/Laputa/essay/engineering-leadership-101.md',
    filename: 'engineering-leadership-101.md',
    title: 'Engineering Leadership 101',
    isA: 'Essay',
    aliases: [],
    belongsTo: ['[[responsibility/grow-newsletter]]'],
    relatedTo: ['[[topic/software-development]]'],
    status: null,
    owner: null,
    cadence: null,
    archived: false,
    trashed: false,
    trashedAt: null,
    modifiedAt: Date.now() / 1000 - 86400 * 7,
    createdAt: Date.now() / 1000 - 86400 * 30,
    fileSize: 3800,
    snippet: 'The transition from IC to manager is the hardest career shift in engineering.',
    relationships: {
      'Belongs to': ['[[responsibility/grow-newsletter]]'],
      'Related to': ['[[topic/software-development]]'],
      'Type': ['[[type/essay]]'],
    },
    icon: null,
    color: null,
    order: null,
  },
  {
    path: '/Users/luca/Laputa/essay/ai-agents-primer.md',
    filename: 'ai-agents-primer.md',
    title: 'AI Agents Primer',
    isA: 'Essay',
    aliases: [],
    belongsTo: ['[[responsibility/grow-newsletter]]'],
    relatedTo: [],
    status: null,
    owner: null,
    cadence: null,
    archived: false,
    trashed: false,
    trashedAt: null,
    modifiedAt: Date.now() / 1000 - 86400 * 10,
    createdAt: Date.now() / 1000 - 86400 * 21,
    fileSize: 5100,
    snippet: 'AI agents are autonomous systems that can plan, execute, and adapt to achieve goals.',
    relationships: {
      'Belongs to': ['[[responsibility/grow-newsletter]]'],
      'Type': ['[[type/essay]]'],
    },
    icon: null,
    color: null,
    order: null,
  },
  // --- Type documents ---
  {
    path: '/Users/luca/Laputa/type/project.md',
    filename: 'project.md',
    title: 'Project',
    isA: 'Type',
    aliases: [],
    belongsTo: [],
    relatedTo: [],
    status: null,
    owner: null,
    cadence: null,
    archived: false,
    trashed: false,
    trashedAt: null,
    modifiedAt: Date.now() / 1000 - 86400 * 90,
    createdAt: Date.now() / 1000 - 86400 * 365,
    fileSize: 320,
    snippet: 'A time-bound initiative that advances a Responsibility. Projects have a clear start, end, and deliverables.',
    relationships: {},
    icon: null,
    color: null,
    order: 0,
  },
  {
    path: '/Users/luca/Laputa/type/responsibility.md',
    filename: 'responsibility.md',
    title: 'Responsibility',
    isA: 'Type',
    aliases: [],
    belongsTo: [],
    relatedTo: [],
    status: null,
    owner: null,
    cadence: null,
    archived: false,
    trashed: false,
    trashedAt: null,
    modifiedAt: Date.now() / 1000 - 86400 * 90,
    createdAt: Date.now() / 1000 - 86400 * 365,
    fileSize: 280,
    snippet: 'An ongoing area of ownership — something you\'re accountable for indefinitely.',
    relationships: {},
    icon: null,
    color: null,
    order: 1,
  },
  {
    path: '/Users/luca/Laputa/type/procedure.md',
    filename: 'procedure.md',
    title: 'Procedure',
    isA: 'Type',
    aliases: [],
    belongsTo: [],
    relatedTo: [],
    status: null,
    owner: null,
    cadence: null,
    archived: false,
    trashed: false,
    trashedAt: null,
    modifiedAt: Date.now() / 1000 - 86400 * 90,
    createdAt: Date.now() / 1000 - 86400 * 365,
    fileSize: 310,
    snippet: 'A recurring process tied to a Responsibility. Procedures have a cadence and describe how to do something.',
    relationships: {},
    icon: null,
    color: null,
    order: 2,
  },
  {
    path: '/Users/luca/Laputa/type/experiment.md',
    filename: 'experiment.md',
    title: 'Experiment',
    isA: 'Type',
    aliases: [],
    belongsTo: [],
    relatedTo: [],
    status: null,
    owner: null,
    cadence: null,
    archived: false,
    trashed: false,
    trashedAt: null,
    modifiedAt: Date.now() / 1000 - 86400 * 90,
    createdAt: Date.now() / 1000 - 86400 * 365,
    fileSize: 290,
    snippet: 'A hypothesis-driven investigation with a clear test and measurable outcome.',
    relationships: {},
    icon: null,
    color: null,
    order: 3,
  },
  {
    path: '/Users/luca/Laputa/type/person.md',
    filename: 'person.md',
    title: 'Person',
    isA: 'Type',
    aliases: [],
    belongsTo: [],
    relatedTo: [],
    status: null,
    owner: null,
    cadence: null,
    archived: false,
    trashed: false,
    trashedAt: null,
    modifiedAt: Date.now() / 1000 - 86400 * 90,
    createdAt: Date.now() / 1000 - 86400 * 365,
    fileSize: 200,
    snippet: 'A person you interact with — team members, collaborators, contacts.',
    relationships: {},
    icon: null,
    color: null,
    order: 4,
  },
  {
    path: '/Users/luca/Laputa/type/event.md',
    filename: 'event.md',
    title: 'Event',
    isA: 'Type',
    aliases: [],
    belongsTo: [],
    relatedTo: [],
    status: null,
    owner: null,
    cadence: null,
    archived: false,
    trashed: false,
    trashedAt: null,
    modifiedAt: Date.now() / 1000 - 86400 * 90,
    createdAt: Date.now() / 1000 - 86400 * 365,
    fileSize: 180,
    snippet: 'A point-in-time occurrence — meetings, launches, milestones.',
    relationships: {},
    icon: null,
    color: null,
    order: 5,
  },
  {
    path: '/Users/luca/Laputa/type/topic.md',
    filename: 'topic.md',
    title: 'Topic',
    isA: 'Type',
    aliases: [],
    belongsTo: [],
    relatedTo: [],
    status: null,
    owner: null,
    cadence: null,
    archived: false,
    trashed: false,
    trashedAt: null,
    modifiedAt: Date.now() / 1000 - 86400 * 90,
    createdAt: Date.now() / 1000 - 86400 * 365,
    fileSize: 170,
    snippet: 'A subject area for categorization. Topics group related notes, projects, and resources by theme.',
    relationships: {},
    icon: null,
    color: null,
    order: 6,
  },
  {
    path: '/Users/luca/Laputa/type/essay.md',
    filename: 'essay.md',
    title: 'Essay',
    isA: 'Type',
    aliases: [],
    belongsTo: [],
    relatedTo: [],
    status: null,
    owner: null,
    cadence: null,
    archived: false,
    trashed: false,
    trashedAt: null,
    modifiedAt: Date.now() / 1000 - 86400 * 90,
    createdAt: Date.now() / 1000 - 86400 * 365,
    fileSize: 200,
    snippet: 'A published piece of writing — newsletter essays, blog posts, articles.',
    relationships: {},
    icon: null,
    color: null,
    order: 7,
  },
  {
    path: '/Users/luca/Laputa/type/note.md',
    filename: 'note.md',
    title: 'Note',
    isA: 'Type',
    aliases: [],
    belongsTo: [],
    relatedTo: [],
    status: null,
    owner: null,
    cadence: null,
    archived: false,
    trashed: false,
    trashedAt: null,
    modifiedAt: Date.now() / 1000 - 86400 * 90,
    createdAt: Date.now() / 1000 - 86400 * 365,
    fileSize: 190,
    snippet: 'A general-purpose document — research notes, meeting notes, strategy docs.',
    relationships: {},
    icon: null,
    color: null,
    order: 8,
  },
  // --- Custom type documents (user-created types) ---
  {
    path: '/Users/luca/Laputa/type/recipe.md',
    filename: 'recipe.md',
    title: 'Recipe',
    isA: 'Type',
    aliases: [],
    belongsTo: [],
    relatedTo: [],
    status: null,
    owner: null,
    cadence: null,
    archived: false,
    trashed: false,
    trashedAt: null,
    modifiedAt: Date.now() / 1000 - 86400 * 30,
    createdAt: Date.now() / 1000 - 86400 * 365,
    fileSize: 250,
    snippet: 'A recipe for cooking or baking. Recipes have ingredients, steps, and serving info.',
    relationships: {},
    icon: 'cooking-pot',
    color: 'orange',
    order: 9,
  },
  {
    path: '/Users/luca/Laputa/type/book.md',
    filename: 'book.md',
    title: 'Book',
    isA: 'Type',
    aliases: [],
    belongsTo: [],
    relatedTo: [],
    status: null,
    owner: null,
    cadence: null,
    archived: false,
    trashed: false,
    trashedAt: null,
    modifiedAt: Date.now() / 1000 - 86400 * 30,
    createdAt: Date.now() / 1000 - 86400 * 365,
    fileSize: 220,
    snippet: 'A book you\'re reading or have read. Track reading progress, notes, and key takeaways.',
    relationships: {},
    icon: 'book-open',
    color: 'green',
    order: 10,
  },
  // --- Instances of custom types ---
  {
    path: '/Users/luca/Laputa/recipe/pasta-carbonara.md',
    filename: 'pasta-carbonara.md',
    title: 'Pasta Carbonara',
    isA: 'Recipe',
    aliases: [],
    belongsTo: [],
    relatedTo: [],
    status: null,
    owner: null,
    cadence: null,
    archived: false,
    trashed: false,
    trashedAt: null,
    modifiedAt: Date.now() / 1000 - 86400 * 5,
    createdAt: Date.now() / 1000 - 86400 * 10,
    fileSize: 420,
    snippet: 'Classic Roman pasta dish with eggs, pecorino, guanciale, and black pepper.',
    relationships: {
      'Type': ['[[type/recipe]]'],
    },
    icon: null,
    color: null,
    order: null,
  },
  {
    path: '/Users/luca/Laputa/book/designing-data-intensive-applications.md',
    filename: 'designing-data-intensive-applications.md',
    title: 'Designing Data-Intensive Applications',
    isA: 'Book',
    aliases: [],
    belongsTo: [],
    relatedTo: [],
    status: null,
    owner: null,
    cadence: null,
    archived: false,
    trashed: false,
    trashedAt: null,
    modifiedAt: Date.now() / 1000 - 86400 * 14,
    createdAt: Date.now() / 1000 - 86400 * 60,
    fileSize: 380,
    snippet: 'Essential reading for anyone building distributed systems. Covers replication, partitioning, transactions.',
    relationships: {
      'Type': ['[[type/book]]'],
    },
    icon: null,
    color: null,
    order: null,
  },
  // --- Trashed entries ---
  {
    path: '/Users/luca/Laputa/note/old-draft-notes.md',
    filename: 'old-draft-notes.md',
    title: 'Old Draft Notes',
    isA: 'Note',
    aliases: [],
    belongsTo: ['[[project/26q1-laputa-app]]'],
    relatedTo: [],
    status: null,
    owner: null,
    cadence: null,
    archived: false,
    trashed: true,
    trashedAt: Date.now() / 1000 - 86400 * 5,
    modifiedAt: Date.now() / 1000 - 86400 * 10,
    createdAt: null,
    fileSize: 280,
    snippet: 'Some rough draft content that is no longer relevant. Moving to trash.',
    relationships: {
      'Belongs to': ['[[project/26q1-laputa-app]]'],
      'Type': ['[[type/note]]'],
    },
    icon: null,
    color: null,
    order: null,
  },
  {
    path: '/Users/luca/Laputa/note/deprecated-api-notes.md',
    filename: 'deprecated-api-notes.md',
    title: 'Deprecated API Notes',
    isA: 'Note',
    aliases: [],
    belongsTo: [],
    relatedTo: [],
    status: null,
    owner: null,
    cadence: null,
    archived: false,
    trashed: true,
    trashedAt: Date.now() / 1000 - 86400 * 35,
    modifiedAt: Date.now() / 1000 - 86400 * 40,
    createdAt: null,
    fileSize: 190,
    snippet: 'Old API documentation for the v1 endpoint. Replaced by v2 docs.',
    relationships: {
      'Type': ['[[type/note]]'],
    },
    icon: null,
    color: null,
    order: null,
  },
  {
    path: '/Users/luca/Laputa/experiment/failed-seo-experiment.md',
    filename: 'failed-seo-experiment.md',
    title: 'Failed SEO Experiment',
    isA: 'Experiment',
    aliases: [],
    belongsTo: [],
    relatedTo: ['[[responsibility/grow-newsletter]]'],
    status: 'Dropped',
    owner: 'Luca Rossi',
    cadence: null,
    archived: false,
    trashed: true,
    trashedAt: Date.now() / 1000 - 86400 * 10,
    modifiedAt: Date.now() / 1000 - 86400 * 15,
    createdAt: null,
    fileSize: 340,
    snippet: 'Tried programmatic SEO pages. Results were negligible — trashing this.',
    relationships: {
      'Related to': ['[[responsibility/grow-newsletter]]'],
      'Type': ['[[type/experiment]]'],
    },
    icon: null,
    color: null,
    order: null,
  },
  // --- Archived entries ---
  {
    path: '/Users/luca/Laputa/project/25q3-website-redesign.md',
    filename: '25q3-website-redesign.md',
    title: 'Website Redesign',
    isA: 'Project',
    aliases: [],
    belongsTo: ['[[quarter/q3-2025]]'],
    relatedTo: [],
    status: 'Done',
    owner: 'Luca Rossi',
    cadence: null,
    archived: true,
    trashed: false,
    trashedAt: null,
    icon: null,
    color: null,
    order: null,
    modifiedAt: Date.now() / 1000 - 86400 * 120,
    createdAt: Date.now() / 1000 - 86400 * 200,
    fileSize: 680,
    snippet: 'Completed redesign of the company website. Migrated from WordPress to Next.js with improved performance and SEO.',
    relationships: {
      'Belongs to': ['[[quarter/q3-2025]]'],
      'Type': ['[[type/project]]'],
    },
  },
  {
    path: '/Users/luca/Laputa/experiment/twitter-thread-experiment.md',
    filename: 'twitter-thread-experiment.md',
    title: 'Twitter Thread Growth Experiment',
    isA: 'Experiment',
    aliases: [],
    belongsTo: [],
    relatedTo: ['[[responsibility/grow-newsletter]]'],
    status: 'Done',
    owner: 'Luca Rossi',
    cadence: null,
    archived: true,
    trashed: false,
    trashedAt: null,
    icon: null,
    color: null,
    order: null,
    modifiedAt: Date.now() / 1000 - 86400 * 90,
    createdAt: Date.now() / 1000 - 86400 * 150,
    fileSize: 520,
    snippet: 'Publishing 3 Twitter threads per week instead of 1 will increase newsletter signups by 50%. Result: only 12% increase.',
    relationships: {
      'Related to': ['[[responsibility/grow-newsletter]]'],
      'Type': ['[[type/experiment]]'],
    },
  },
]

// --- Bulk entry generator for large vault testing ---

const BULK_TYPES = ['Note', 'Project', 'Experiment', 'Responsibility', 'Procedure', 'Person', 'Event', 'Essay', 'Topic']
const BULK_ADJECTIVES = ['Quick', 'Advanced', 'Daily', 'Weekly', 'Annual', 'Draft', 'Final', 'Revised', 'Archived', 'New']
const BULK_NOUNS = ['Meeting', 'Strategy', 'Review', 'Plan', 'Analysis', 'Summary', 'Report', 'Guide', 'Checklist', 'Template', 'Framework', 'Workflow', 'Retrospective', 'Brainstorm', 'Proposal']
const BULK_SNIPPETS = [
  'Key findings from the latest analysis session.',
  'Notes on process improvements and next steps.',
  'Summary of decisions made during the review.',
  'Action items and follow-ups from discussion.',
  'Draft outline for upcoming deliverable.',
  'Reference material for the ongoing initiative.',
  'Tracking progress on quarterly objectives.',
  'Comparison of different approaches considered.',
]

function generateBulkEntries(count: number): VaultEntry[] {
  const now = Date.now() / 1000
  const entries: VaultEntry[] = []
  for (let i = 0; i < count; i++) {
    const type = BULK_TYPES[i % BULK_TYPES.length]
    const adj = BULK_ADJECTIVES[i % BULK_ADJECTIVES.length]
    const noun = BULK_NOUNS[i % BULK_NOUNS.length]
    const title = `${adj} ${noun} ${i + 1}`
    const slug = title.toLowerCase().replace(/\s+/g, '-')
    const folder = type.toLowerCase()
    entries.push({
      path: `/Users/luca/Laputa/${folder}/${slug}.md`,
      filename: `${slug}.md`,
      title,
      isA: type,
      aliases: [],
      belongsTo: [],
      relatedTo: [],
      status: i % 4 === 0 ? 'Active' : i % 4 === 1 ? 'Paused' : i % 4 === 2 ? 'Done' : null,
      owner: i % 3 === 0 ? 'Luca Rossi' : null,
      cadence: null,
      archived: false,
      trashed: false,
      trashedAt: null,
      modifiedAt: now - i * 600,
      createdAt: now - 86400 * 90 - i * 3600,
      fileSize: 500 + (i % 2000),
      snippet: BULK_SNIPPETS[i % BULK_SNIPPETS.length],
      relationships: {},
      icon: null,
      color: null,
      order: null,
    })
  }
  return entries
}

// Append 9000 generated entries for realistic large-vault testing
MOCK_ENTRIES.push(...generateBulkEntries(9000))

function mockFileHistory(path: string): GitCommit[] {
  const filename = path.split('/').pop()?.replace('.md', '') ?? 'unknown'
  const now = Math.floor(Date.now() / 1000)
  return [
    {
      hash: 'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0',
      shortHash: 'a1b2c3d',
      message: `Update ${filename} with latest changes`,
      author: 'Luca Rossi',
      date: now - 86400 * 2,
    },
    {
      hash: 'e4f5g6h7i8j9k0l1m2n3o4p5q6r7s8t9u0v1w2x3',
      shortHash: 'e4f5g6h',
      message: `Add new section to ${filename}`,
      author: 'Luca Rossi',
      date: now - 86400 * 5,
    },
    {
      hash: 'i7j8k9l0m1n2o3p4q5r6s7t8u9v0w1x2y3z4a5b6',
      shortHash: 'i7j8k9l',
      message: `Fix formatting in ${filename}`,
      author: 'Luca Rossi',
      date: now - 86400 * 12,
    },
    {
      hash: 'm0n1o2p3q4r5s6t7u8v9w0x1y2z3a4b5c6d7e8f9',
      shortHash: 'm0n1o2p',
      message: `Create ${filename}`,
      author: 'Luca Rossi',
      date: now - 86400 * 30,
    },
  ]
}

function mockModifiedFiles(): ModifiedFile[] {
  return [
    {
      path: '/Users/luca/Laputa/project/26q1-laputa-app.md',
      relativePath: 'project/26q1-laputa-app.md',
      status: 'modified',
    },
    {
      path: '/Users/luca/Laputa/note/facebook-ads-strategy.md',
      relativePath: 'note/facebook-ads-strategy.md',
      status: 'modified',
    },
    {
      path: '/Users/luca/Laputa/essay/ai-agents-primer.md',
      relativePath: 'essay/ai-agents-primer.md',
      status: 'added',
    },
  ]
}

function mockFileDiff(path: string): string {
  const filename = path.split('/').pop() ?? 'unknown'
  return `diff --git a/${filename} b/${filename}
index abc1234..def5678 100644
--- a/${filename}
+++ b/${filename}
@@ -1,8 +1,10 @@
 ---
 title: Example Note
 type: Note
+status: Active
 ---

 # Example Note

-This is the original content.
+This is the updated content.
+
+A new paragraph has been added.`
}

function mockFileDiffAtCommit(path: string, commitHash: string): string {
  const filename = path.split('/').pop() ?? 'unknown'
  const shortHash = commitHash.slice(0, 7)
  return `diff --git a/${filename} b/${filename}
index abc1234..${shortHash} 100644
--- a/${filename}
+++ b/${filename}
@@ -5,3 +5,5 @@
 ---

 # Example Note
-Old paragraph from before ${shortHash}.
+Updated paragraph at commit ${shortHash}.
+
+New content added in this commit.`
}

let mockHasChanges = true
/** Tracks paths saved since the last mock commit — used by get_modified_files */
const mockSavedSinceCommit = new Set<string>()

function trimOrNull(value: string | null | undefined): string | null {
  return value?.trim() || null
}

let mockSettings: Settings = {
  anthropic_key: null,
  openai_key: null,
  google_key: null,
  github_token: 'gho_mock_token_for_testing',
  github_username: 'lucaong',
}

// Track mock device flow state: poll returns 'pending' once, then 'complete'
let mockDeviceFlowPollCount = 0

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- mock handler map accepts heterogeneous arg types
const mockHandlers: Record<string, (args: any) => any> = {
  list_vault: () => MOCK_ENTRIES,
  get_note_content: (args: { path: string }) => MOCK_CONTENT[args.path] ?? '',
  get_all_content: () => MOCK_CONTENT,
  get_file_history: (args: { path: string }) => mockFileHistory(args.path),
  get_modified_files: () => {
    const base = mockHasChanges ? mockModifiedFiles() : []
    const basePaths = new Set(base.map(f => f.path))
    const extra: ModifiedFile[] = [...mockSavedSinceCommit]
      .filter(p => !basePaths.has(p))
      .map(p => ({
        path: p,
        relativePath: p.replace(/^.*?\/Laputa\//, ''),
        status: 'modified' as const,
      }))
    return [...base, ...extra]
  },
  get_file_diff: (args: { path: string }) => mockFileDiff(args.path),
  get_file_diff_at_commit: (args: { path: string; commitHash: string }) => mockFileDiffAtCommit(args.path, args.commitHash),
  git_commit: (args: { message: string }) => {
    const count = (mockHasChanges ? mockModifiedFiles().length : 0) + mockSavedSinceCommit.size
    mockHasChanges = false
    mockSavedSinceCommit.clear()
    return `[main abc1234] ${args.message}\n ${count} files changed`
  },
  git_push: () => {
    return 'Everything up-to-date'
  },
  ai_chat: (args: { request: { messages: { role: string; content: string }[]; model?: string; system?: string } }) => {
    const lastMsg = args.request.messages[args.request.messages.length - 1]?.content ?? ''
    const lower = lastMsg.toLowerCase()
    let content = `I can help you with that. Could you provide more details about what you'd like to know?`
    if (lower.includes('summarize')) {
      content = `Here's a summary of the note:\n\n**Key Points:**\n- The note covers the main topic and its related concepts\n- It includes actionable items and references to other notes\n- Several wiki-links connect it to the broader knowledge base\n\nWould you like me to expand on any of these points?`
    } else if (lower.includes('expand')) {
      content = `Here are suggestions to expand this note:\n\n1. **Add context** — Include background information\n2. **Link related notes** — Connect to [[related topics]]\n3. **Add examples** — Include concrete examples\n4. **Update status** — Reflect current progress`
    } else if (lower.includes('grammar')) {
      content = `Grammar review complete. The writing is clear and well-structured. Minor suggestions:\n\n- Consider varying sentence lengths for better rhythm\n- A few passive constructions could be made active`
    }
    return {
      content,
      model: args.request.model ?? 'claude-3-5-haiku-20241022',
      stop_reason: 'end_turn',
    }
  },
  save_note_content: (args: { path: string; content: string }) => {
    MOCK_CONTENT[args.path] = args.content
    mockSavedSinceCommit.add(args.path)
    if (typeof window !== 'undefined') {
      window.__mockContent = MOCK_CONTENT
    }
    return null
  },
  save_image: (args: { vault_path?: string; filename: string; data: string }) => {
    // Return a plausible file path matching the real Rust backend behavior
    const vault = args.vault_path ?? '/Users/luca/Laputa'
    const timestamp = Date.now()
    return `${vault}/attachments/${timestamp}-${args.filename}`
  },
  get_settings: () => ({ ...mockSettings }),
  save_settings: (args: { settings: Settings }) => {
    const s = args.settings
    mockSettings = {
      anthropic_key: trimOrNull(s.anthropic_key),
      openai_key: trimOrNull(s.openai_key),
      google_key: trimOrNull(s.google_key),
      github_token: trimOrNull(s.github_token),
      github_username: trimOrNull(s.github_username),
    }
    return null
  },
  rename_note: (args: { vault_path: string; old_path: string; new_title: string }) => {
    const oldContent = MOCK_CONTENT[args.old_path] ?? ''
    const slug = args.new_title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
    const parentDir = args.old_path.replace(/\/[^/]+$/, '')
    const newPath = `${parentDir}/${slug}.md`

    // Update H1 heading in content
    const newContent = oldContent.replace(/^# .+$/m, `# ${args.new_title}`)

    // Move content to new path
    delete MOCK_CONTENT[args.old_path]
    MOCK_CONTENT[newPath] = newContent

    // Update wikilinks in other notes
    const oldEntry = MOCK_ENTRIES.find(e => e.path === args.old_path)
    const oldTitle = oldEntry?.title ?? ''
    let updatedFiles = 0
    if (oldTitle) {
      const pattern = new RegExp(`\\[\\[${oldTitle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(\\|[^\\]]*?)?\\]\\]`, 'g')
      for (const [path, content] of Object.entries(MOCK_CONTENT)) {
        if (path === newPath) continue
        const replaced = content.replace(pattern, (_m: string, pipe: string | undefined) =>
          pipe ? `[[${args.new_title}${pipe}]]` : `[[${args.new_title}]]`
        )
        if (replaced !== content) {
          MOCK_CONTENT[path] = replaced
          updatedFiles++
        }
      }
    }

    if (typeof window !== 'undefined') {
      window.__mockContent = MOCK_CONTENT
    }
    return { new_path: newPath, updated_files: updatedFiles }
  },
  github_list_repos: () => [
    { name: 'laputa-vault', full_name: 'lucaong/laputa-vault', description: 'Personal knowledge vault — markdown + YAML frontmatter', private: true, clone_url: 'https://github.com/lucaong/laputa-vault.git', html_url: 'https://github.com/lucaong/laputa-vault', updated_at: '2026-02-20T10:30:00Z' },
    { name: 'laputa-app', full_name: 'lucaong/laputa-app', description: 'Laputa desktop app — Tauri + React + CodeMirror 6', private: false, clone_url: 'https://github.com/lucaong/laputa-app.git', html_url: 'https://github.com/lucaong/laputa-app', updated_at: '2026-02-19T15:00:00Z' },
    { name: 'dotfiles', full_name: 'lucaong/dotfiles', description: 'My macOS dotfiles and config', private: false, clone_url: 'https://github.com/lucaong/dotfiles.git', html_url: 'https://github.com/lucaong/dotfiles', updated_at: '2026-01-15T08:00:00Z' },
    { name: 'notes-archive', full_name: 'lucaong/notes-archive', description: 'Archived notes from 2024', private: true, clone_url: 'https://github.com/lucaong/notes-archive.git', html_url: 'https://github.com/lucaong/notes-archive', updated_at: '2025-12-01T12:00:00Z' },
    { name: 'obsidian-vault', full_name: 'lucaong/obsidian-vault', description: null, private: true, clone_url: 'https://github.com/lucaong/obsidian-vault.git', html_url: 'https://github.com/lucaong/obsidian-vault', updated_at: '2025-11-05T09:00:00Z' },
  ],
  github_create_repo: (args: { name: string; private: boolean }) => ({
    name: args.name,
    full_name: `lucaong/${args.name}`,
    description: 'Laputa vault',
    private: args.private,
    clone_url: `https://github.com/lucaong/${args.name}.git`,
    html_url: `https://github.com/lucaong/${args.name}`,
    updated_at: new Date().toISOString(),
  }),
  clone_repo: (args: { url: string; local_path: string }) => `Cloned to ${args.local_path}`,
  purge_trash: () => [],
  migrate_is_a_to_type: () => 0,
  github_device_flow_start: (): DeviceFlowStart => {
    mockDeviceFlowPollCount = 0
    return {
      device_code: 'mock_device_code_abc123',
      user_code: 'ABCD-1234',
      verification_uri: 'https://github.com/login/device',
      expires_in: 900,
      interval: 5,
    }
  },
  github_device_flow_poll: (): DeviceFlowPollResult => {
    mockDeviceFlowPollCount++
    if (mockDeviceFlowPollCount <= 1) {
      return { status: 'pending', access_token: null, error: 'authorization_pending' }
    }
    return { status: 'complete', access_token: 'gho_mock_oauth_token_xyz', error: null }
  },
  github_get_user: (): GitHubUser => ({
    login: 'lucaong',
    name: 'Luca Ongaro',
    avatar_url: 'https://avatars.githubusercontent.com/u/123456?v=4',
  }),
}

export function isTauri(): boolean {
  return typeof window !== 'undefined' && ('__TAURI__' in window || '__TAURI_INTERNALS__' in window)
}

// Initialize window.__mockContent for browser testing
if (typeof window !== 'undefined') {
  window.__mockContent = MOCK_CONTENT
}

/** Register content for a new entry in mock mode (for get_note_content calls) */
export function addMockEntry(_entry: VaultEntry, content: string) {
  MOCK_CONTENT[_entry.path] = content
  if (typeof window !== 'undefined') {
    window.__mockContent = MOCK_CONTENT
  }
}

/** Update content for an existing entry in mock mode */
export function updateMockContent(path: string, content: string) {
  MOCK_CONTENT[path] = content
  if (typeof window !== 'undefined') {
    window.__mockContent = MOCK_CONTENT
  }
}

// Vault API routes: maps command names to their API endpoints.
// If extract is provided, it transforms the JSON response before returning.
const VAULT_API_ROUTES: Record<string, {
  endpoint: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- generic JSON extraction
  extract?: (json: any) => unknown
}> = {
  list_vault: { endpoint: '/api/vault/list' },
  get_note_content: { endpoint: '/api/vault/content', extract: (json) => json.content },
  get_all_content: { endpoint: '/api/vault/all-content' },
}

async function tryVaultApi<T>(cmd: string, args?: Record<string, unknown>): Promise<T | undefined> {
  const route = VAULT_API_ROUTES[cmd]
  if (!route || !args?.path) return undefined

  const res = await fetch(`${route.endpoint}?path=${encodeURIComponent(args.path as string)}`)
  if (!res.ok) return undefined

  const json = await res.json()
  return (route.extract ? route.extract(json) : json) as T
}

export async function mockInvoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  if (await checkVaultApi()) {
    try {
      const result = await tryVaultApi<T>(cmd, args)
      if (result !== undefined) return result
    } catch (err) {
      console.warn(`[mock-tauri] Vault API call failed for ${cmd}, falling back to mock:`, err)
    }
  }

  const handler = mockHandlers[cmd]
  if (handler) {
    await new Promise((r) => setTimeout(r, 100))
    return handler(args) as T
  }
  throw new Error(`No mock handler for command: ${cmd}`)
}
