<script setup lang="ts">
// Docs home: the landing's full-bleed blue hero (ASCII field, display headline, white-on-blue CTAs, search) with the
// docs sections as cards pulled up into the band. Everything is editable from the page's frontmatter under `tolaria:`
// (see README); the defaults below only fill what the page leaves out.
import { useData, withBase } from "vitepress"
import { computed } from "vue"
import AsciiField from "./AsciiField.vue"
import PhIcon from "./PhIcon.vue"

type Action = { text: string; link: string; icon?: string; theme?: "primary" | "alt" }
type Section = { icon?: string; title: string; text?: string; link: string }

const DEFAULTS = {
  kicker: "Documentation",
  title: ["Learn Tolaria.", "One Markdown file at a time."],
  text: "Install the app, learn how vaults, notes, types and relationships fit together, and get the most out of Git and AI.",
  actions: [
    { text: "Install Tolaria", link: "/start/install", icon: "rocket-launch", theme: "primary" },
    { text: "Getting Started vault", link: "/start/getting-started-vault", theme: "alt" },
  ] as Action[],
  search: "Search the docs",
  sections: [
    { icon: "rocket-launch", title: "Start here", text: "Install Tolaria, first launch, and opening or creating your first vault.", link: "/start/install" },
    { icon: "graph", title: "Concepts", text: "Vaults, notes, types, properties and relationships: the model behind the app.", link: "/concepts/vaults" },
    { icon: "compass", title: "Guides", text: "Step-by-step workflows: capture, organize, wikilinks, views, Git and AI.", link: "/guides/capture-a-note" },
    { icon: "squares-four", title: "Templates", text: "Ready-made vault setups you can start from and adapt.", link: "/templates/portent" },
    { icon: "book-open", title: "Reference", text: "File layout, frontmatter fields, expressions, filters and shortcuts.", link: "/reference/supported-platforms" },
    { icon: "lifebuoy", title: "Troubleshooting", text: "Vault loading, Git auth, AI agents, providers and sync conflicts.", link: "/troubleshooting/vault-not-loading" },
  ] as Section[],
}

const { frontmatter } = useData()
const d = computed(() => {
  const t = (frontmatter.value.tolaria ?? {}) as Partial<typeof DEFAULTS> & { title?: string | string[] }
  const title = t.title ?? DEFAULTS.title
  return { ...DEFAULTS, ...t, title: Array.isArray(title) ? title : [title] }
})
const href = (l: string) => (/^https?:/.test(l) ? l : withBase(l))

// opens VitePress local search (it listens for Cmd/Ctrl+K on window)
function openSearch() {
  window.dispatchEvent(new KeyboardEvent("keydown", { key: "k", code: "KeyK", metaKey: true, ctrlKey: true, bubbles: true }))
}
</script>

<template>
  <div class="tl-home">
    <header class="tl-hero">
      <AsciiField />
      <div class="tl-hero-copy">
        <p class="tl-pill tl-rise" style="--i: 0" data-calm>{{ d.kicker }}</p>
        <h1 class="tl-hero-title">
          <span v-for="(line, i) in d.title" :key="i" class="tl-ml"><span :style="{ '--i': i }" data-calm>{{ line }}</span></span>
        </h1>
        <p class="tl-hero-text tl-rise" style="--i: 2" data-calm>{{ d.text }}</p>
        <div class="tl-hero-actions tl-rise" style="--i: 3">
          <a v-for="a in d.actions" :key="a.link" :href="href(a.link)" :class="['tl-btn', a.theme === 'alt' ? 'tl-btn-alt' : 'tl-btn-primary']" data-calm>
            <PhIcon v-if="a.icon" :name="a.icon" :size="20" />{{ a.text }}
          </a>
        </div>
        <button v-if="d.search" type="button" class="tl-hero-search tl-rise" style="--i: 4" @click="openSearch" data-calm>
          <PhIcon name="magnifying-glass" :size="18" /><span>{{ d.search }}</span><kbd>⌘ K</kbd>
        </button>
      </div>
    </header>
    <section class="tl-sections" aria-label="Documentation sections">
      <ul>
        <li v-for="(s, i) in d.sections" :key="s.link" class="tl-card tl-rise" :style="{ '--i': 5 + i * 0.5 }">
          <span class="tl-tile"><PhIcon :name="s.icon ?? 'file-text'" :size="24" /></span>
          <h2><a :href="href(s.link)">{{ s.title }}</a></h2>
          <p v-if="s.text">{{ s.text }}</p>
          <PhIcon class="tl-card-arrow" name="arrow-up-right" :size="20" />
        </li>
      </ul>
    </section>
  </div>
</template>
