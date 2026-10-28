<script setup lang="ts">
// Tolaria docs layout: VitePress DefaultTheme.Layout plus the landing's identity.
// - drop logo before the "Tolaria" wordmark (display font, styled in styles/theme.css)
// - GitHub star count + a primary Download button at the right of the nav (white on primary blue)
// - a slim ASCII band above the doc when the page's frontmatter has `band:` or themeConfig.tolaria.bands lists the path
// - html.tl-hero-page while a page carries `tolaria:` frontmatter (the docs home): the frosted nav floats over the
//   full-bleed blue hero as a pill, like on the landing
// - html.tl-scrolled after 8px of scroll (nav shadow)
import DefaultTheme from "vitepress/theme-without-fonts"
import { useData, withBase } from "vitepress"
import { computed, onBeforeUnmount, onMounted, ref, watchEffect } from "vue"
import PhIcon from "./components/PhIcon.vue"
import DocsBand from "./components/DocsBand.vue"
import drop from "./assets/tolaria-drop.svg"

const { frontmatter, theme, page } = useData()
const opts = computed(() => ({
  github: "https://github.com/refactoringhq/tolaria",
  download: "/download/",
  stars: "9,946",
  ...(theme.value.tolaria ?? {}),
}))
const downloadHref = computed(() => (/^https?:/.test(opts.value.download) ? opts.value.download : withBase(opts.value.download)))
const stars = ref<string>(opts.value.stars)

// GitHub stars: cached for an hour in localStorage, bundled fallback when the API is unavailable or rate-limited
const CACHE_KEY = "tolaria:github-stars", TTL = 60 * 60 * 1000
const fmt = (n: number) => new Intl.NumberFormat("en-US").format(n)
async function loadStars() {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    const c = raw ? (JSON.parse(raw) as { stars?: number; savedAt?: number }) : null
    if (c && typeof c.stars === "number" && typeof c.savedAt === "number") {
      stars.value = fmt(c.stars)
      if (Date.now() - c.savedAt < TTL) return
    }
    const repo = opts.value.github.replace(/^https:\/\/github\.com\//, "")
    const r = await fetch(`https://api.github.com/repos/${repo}`, { headers: { Accept: "application/vnd.github+json" } })
    if (!r.ok) return
    const j = (await r.json()) as { stargazers_count?: unknown }
    if (typeof j.stargazers_count !== "number") return
    localStorage.setItem(CACHE_KEY, JSON.stringify({ stars: j.stargazers_count, savedAt: Date.now() }))
    stars.value = fmt(j.stargazers_count)
  } catch { /* keep the fallback */ }
}

// band: page frontmatter `band:` wins, else themeConfig.tolaria.bands["/concepts/vaults"] (no content edits needed)
const band = computed(() => {
  if (frontmatter.value.band) return frontmatter.value.band
  const path = `/${page.value.relativePath.replace(/(index)?\.md$/, "")}`
  return opts.value.bands?.[path] ?? opts.value.bands?.[path.replace(/\/$/, "")] ?? null
})
const isHero = computed(() => Boolean(frontmatter.value.tolaria))
// iPhone status bar / notch on the docs home: theme-color = hero blue and viewport-fit=cover, so the blue runs under the
// status bar (the hero and the floating nav add env(safe-area-inset-top)); other pages get the defaults back.
const HERO_BLUE = "#155DFF"
function setMeta(name: string, content: string | null) {
  let m = document.querySelector<HTMLMetaElement>(`meta[name="${name}"]`)
  if (content === null) { if (m?.dataset.tl) m.remove(); return }
  if (!m) { m = document.createElement("meta"); m.name = name; m.dataset.tl = "1"; document.head.appendChild(m) }
  m.content = content
}
watchEffect(() => {
  if (typeof document === "undefined") return
  const hero = isHero.value
  document.documentElement.classList.toggle("tl-hero-page", hero)
  setMeta("theme-color", hero ? HERO_BLUE : null)
  const vp = document.querySelector<HTMLMetaElement>('meta[name="viewport"]')
  if (vp) {
    const base = vp.content.replace(/,\s*viewport-fit=cover/, "")
    vp.content = hero ? `${base}, viewport-fit=cover` : base
  }
})
const onScroll = () => document.documentElement.classList.toggle("tl-scrolled", window.scrollY > 8)
onMounted(() => { onScroll(); window.addEventListener("scroll", onScroll, { passive: true }); void loadStars() })
onBeforeUnmount(() => {
  window.removeEventListener("scroll", onScroll)
  document.documentElement.classList.remove("tl-scrolled", "tl-hero-page")
})
</script>

<template>
  <DefaultTheme.Layout>
    <template #nav-bar-title-before>
      <img class="tl-drop" :src="drop" alt="" width="14" height="19" />
    </template>
    <template #nav-bar-content-after>
      <div class="tl-nav-actions">
        <a class="tl-star" :href="opts.github" target="_blank" rel="noopener" :aria-label="`Tolaria on GitHub, ${stars} stars`">
          <PhIcon name="github-logo" :size="16" /><span>{{ stars }}</span>
        </a>
        <a class="tl-download" :href="downloadHref" target="_self">
          <PhIcon name="download-simple" :size="16" /><span>Download</span>
        </a>
      </div>
    </template>
    <template #doc-before>
      <DocsBand v-if="band" :band="band" />
    </template>
  </DefaultTheme.Layout>
</template>
