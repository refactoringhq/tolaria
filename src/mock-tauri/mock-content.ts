/**
 * Mock markdown content keyed by file path.
 * Used by the mock Tauri layer when running in browser dev mode.
 */

export const MOCK_CONTENT: Record<string, string> = {
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
  '/Users/luca/Laputa/person/maria-bianchi.md': `---
title: Maria Bianchi
type: Person
aliases:
  - Maria
---

# Maria Bianchi

## Role
Product designer — leads UX research and design sprints for the app.

## Contact
- Email: maria@example.com
- Slack: @maria
`,
  '/Users/luca/Laputa/person/marco-verdi.md': `---
title: Marco Verdi
type: Person
aliases:
  - Marco
---

# Marco Verdi

## Role
Frontend engineer — focuses on React performance and accessibility.

## Contact
- Email: marco@example.com
`,
  '/Users/luca/Laputa/person/elena-russo.md': `---
title: Elena Russo
type: Person
aliases:
  - Elena
---

# Elena Russo

## Role
Content strategist — plans newsletter topics and manages the editorial calendar.
`,
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
