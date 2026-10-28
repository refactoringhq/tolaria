<script setup lang="ts">
// Slim blue band with the ASCII field, for section index pages. Rendered by Layout.vue when either
//   page frontmatter:  band: true | { kicker, title, text }
//   or config:         themeConfig.tolaria.bands = { "/concepts/vaults": { kicker: "Concepts", text: "..." } }
// The page's own H1 follows right below, so the band never repeats it: give it a kicker (section name), a title and a
// short text; `band: true` alone shows the page description as the title.
import { useData } from "vitepress"
import { computed } from "vue"
import AsciiField from "./AsciiField.vue"

const props = defineProps<{ band: boolean | { kicker?: string; title?: string; text?: string } }>()
const { page } = useData()
const b = computed(() => {
  const f = props.band
  const o = typeof f === "object" && f ? f : {}
  return { kicker: o.kicker as string | undefined, title: (o.title as string | undefined) ?? (o.kicker ? undefined : page.value.description), text: o.title || o.kicker ? (o.text as string | undefined) : undefined }
})
</script>

<template>
  <div class="tl-band">
    <AsciiField :intensity="0.8" />
    <div class="tl-band-copy">
      <p v-if="b.kicker" class="tl-band-kicker" data-calm>{{ b.kicker }}</p>
      <p v-if="b.title" class="tl-band-title" data-calm>{{ b.title }}</p>
      <p v-if="b.text" class="tl-band-text" data-calm>{{ b.text }}</p>
    </div>
  </div>
</template>
