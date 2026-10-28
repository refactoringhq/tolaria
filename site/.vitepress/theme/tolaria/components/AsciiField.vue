<script setup lang="ts">
// Tolaria ASCII field: a Vue port of the landing hero background (tolaria-landing ui/src/components/landing/HeroBg.tsx).
// Fills its positioned parent (the "host"). Each cell's intensity = slow ambient noise + a "heat" field the pointer
// paints (soft radius, ~800ms eased decay); intensity picks a character up the density ramp, hot cells scramble into
// Markdown glyphs. Elements inside the host matching `calm` (default [data-calm]) get a quieter field behind them so
// copy keeps its contrast. One rAF loop (60fps while heat is live, 30fps ambient), asleep off-screen and when the tab
// is hidden, DPR capped at 2, glyphs blitted from a pre-rendered atlas. Reduced motion: one static frame, no pointer.
// SSR-safe: everything runs in onMounted.
import { onBeforeUnmount, onMounted, ref } from "vue"

const props = withDefaults(defineProps<{
  /** CSS selector (scoped to the host) for the copy blocks the field calms down behind. */
  calm?: string
  /** Overall brightness multiplier (1 = landing hero; ~0.7 suits a slim band). */
  intensity?: number
  /** Glyph colour; white on the primary blue by default. */
  color?: string
  /** Paint a trail where the pointer moves. */
  interactive?: boolean
}>(), { calm: "[data-calm]", intensity: 1, color: "#fff", interactive: true })

const cvRef = ref<HTMLCanvasElement | null>(null)
let cleanup: (() => void) | null = null

const RAMP = " .·:-=+*#%@"
const MD = "#[]->*`_"

onMounted(() => {
  const cv = cvRef.value
  const host = cv?.parentElement?.parentElement
  const ctx = cv?.getContext("2d")
  if (!cv || !host || !ctx) return
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches
  const CHARS = RAMP + MD
  let w = 0, h = 0, dpr = 1, cw = 14, ch = 20, cols = 0, rows = 0
  let heat = new Float32Array(0), scr = new Uint8Array(0), calm = new Float32Array(0)
  const atlas = document.createElement("canvas"), actx = atlas.getContext("2d")
  if (!actx) return
  let raf = 0, last = 0, visible = true, hot = 0
  const t0 = performance.now()
  const ptr = { x: 0, y: 0, has: false }
  const randomValues = new Uint32Array(512)

  const buildAtlas = () => {
    const fs = w < 640 ? 12 : 13
    atlas.width = Math.ceil(cw * dpr) * CHARS.length; atlas.height = Math.ceil(ch * dpr)
    actx.setTransform(dpr, 0, 0, dpr, 0, 0); actx.clearRect(0, 0, atlas.width, atlas.height)
    actx.font = `500 ${fs}px ui-monospace, SFMono-Regular, Menlo, monospace`
    actx.textAlign = "center"; actx.textBaseline = "middle"; actx.fillStyle = props.color
    for (let k = 0; k < CHARS.length; k++) actx.fillText(CHARS[k], (Math.ceil(cw * dpr) / dpr) * k + cw / 2, ch / 2)
  }

  const layout = () => {
    const r = host.getBoundingClientRect()
    w = r.width; h = r.height; dpr = Math.min(2, devicePixelRatio || 1)
    cw = w < 640 ? 13 : 14; ch = w < 640 ? 19 : 20
    cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr)
    cols = Math.ceil(w / cw); rows = Math.ceil(h / ch)
    heat = new Float32Array(cols * rows); scr = new Uint8Array(cols * rows); calm = new Float32Array(cols * rows)
    buildCalmMask(r)
    buildAtlas(); draw(performance.now(), 0)
  }

  const textBounds = (elements: HTMLElement[]) => {
    const rs = elements.map((e) => {
      const q = e.getBoundingClientRect(); const rr = document.createRange(); rr.selectNodeContents(e)
      const t = rr.getBoundingClientRect(); return t.width ? t : q
    }).filter((q) => q.width && q.height)
    return rs.length ? {
      left: Math.min(...rs.map((q) => q.left)), right: Math.max(...rs.map((q) => q.right)),
      top: Math.min(...rs.map((q) => q.top)), bottom: Math.max(...rs.map((q) => q.bottom)),
    } : null
  }

  const calmAtCell = ({ x, y, r, copy, floor }: { x: number; y: number; r: DOMRect; copy: DOMRect | null; floor: number }) => {
    if (!copy) return 1
    const px = x * cw + cw / 2 + r.left, py = y * ch + ch / 2 + r.top
    const dx = Math.max(copy.left - px, 0, px - copy.right), dy = Math.max(copy.top - py, 0, py - copy.bottom)
    return floor + (1 - floor) * Math.min(1, Math.hypot(dx, dy) / (w < 640 ? 40 : 80))
  }

  const buildCalmMask = (r: DOMRect) => {
    // calm mask: tight text bounds of each calm element (not its full box), eased down to `floor` with a soft edge
    const parts = props.calm ? Array.from(host.querySelectorAll<HTMLElement>(props.calm)) : []
    const copy = textBounds(parts)
    const floor = w < 640 ? 0.42 : 0.3
    for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) calm[y * cols + x] = calmAtCell({ x, y, r, copy, floor })
  }

  const splat = (x: number, y: number, amt: number) => {
    const R = w < 640 ? 70 : 96
    const cx0 = Math.max(0, Math.floor((x - R) / cw)), cx1 = Math.min(cols - 1, Math.ceil((x + R) / cw))
    const cy0 = Math.max(0, Math.floor((y - R) / ch)), cy1 = Math.min(rows - 1, Math.ceil((y + R) / ch))
    crypto.getRandomValues(randomValues)
    let randomIndex = 0
    for (let cy = cy0; cy <= cy1; cy++) for (let cx = cx0; cx <= cx1; cx++) {
      const d2 = (cx * cw + cw / 2 - x) ** 2 + (cy * ch + ch / 2 - y) ** 2
      const v = amt * Math.exp(-d2 / (2 * (R * 0.45) ** 2))
      if (v < 0.01) continue
      const i = cy * cols + cx
      heat[i] = Math.min(1, heat[i] + v)
      if (v > 0.25 && randomValues[randomIndex++] / 0x100000000 < 0.35) {
        scr[i] = 1 + Math.floor((randomValues[randomIndex++] / 0x100000000) * MD.length)
      }
    }
    hot = 1
  }

  const drawCell = ({ x, y, t, k, sw, sh, boost, gain }: { x: number; y: number; t: number; k: number; sw: number; sh: number; boost: number; gain: number }) => {
        const i = y * cols + x
        let ht = heat[i]
        if (ht > 0) { ht *= k; if (ht < 0.004) { ht = 0; scr[i] = 0 } heat[i] = ht }
        // ambient: three slow travelling sine fields, sharpened so most of the field stays quiet
        const a = Math.sin(x * 0.11 + t * 0.35) + Math.sin(y * 0.17 - t * 0.27 + x * 0.05) + Math.sin((x + y) * 0.06 + t * 0.18)
        const j = (((i * 2654435761) >>> 0) % 1000) / 1000 - 0.5 // per-cell jitter: organic, grainy field
        const amb = Math.max(0, (a + 3) / 6 + j * 0.28) ** 3 * 0.6
        const v = Math.min(1, (amb * calm[i] * (calm[i] > 0.9 ? boost : 1) + ht * (0.6 + 0.4 * calm[i])) * gain)
        if (v < 0.07) return ht > 0
        const ci = scr[i] && ht > 0.18 ? RAMP.length + scr[i] - 1 : Math.min(RAMP.length - 1, Math.floor(v * RAMP.length))
        if (ci === 0) return ht > 0
        ctx.globalAlpha = Math.min(0.6, 0.08 + v * 0.52)
        ctx.drawImage(atlas, ci * sw, 0, sw, sh, Math.round(x * cw * dpr), Math.round(y * ch * dpr), sw, sh)
        return ht > 0
  }

  const drawGrid = ({ t, k, sw, sh, boost, gain }: { t: number; k: number; sw: number; sh: number; boost: number; gain: number }) => {
    let live = 0
    for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
      if (drawCell({ x, y, t, k, sw, sh, boost, gain })) live++
    }
    return live
  }

  const draw = (now: number, dt: number) => {
    const t = reduce ? 4 : (now - t0) / 1000
    const k = dt ? 0.5 ** (dt / 220) : 1 // heat halves every ~220ms, so a stroke fades out over ~800ms
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, cv.width, cv.height)
    const sw = Math.ceil(cw * dpr), sh = Math.ceil(ch * dpr)
    // phones: copy fills most of the width, so the field outside it runs brighter to stay visible
    const boost = w < 640 ? 3.4 : 1
    const gain = props.intensity
    const live = drawGrid({ t, k, sw, sh, boost, gain })
    ctx.globalAlpha = 1
    hot = live ? 1 : 0
  }

  const tick = (now: number) => {
    raf = 0
    if (!visible || document.hidden) return
    const dt = now - last
    if (dt > (hot ? 15 : 32)) { draw(now, last ? Math.min(dt, 100) : 0); last = now }
    raf = requestAnimationFrame(tick)
  }
  const canStart = () => !reduce && !raf && visible && !document.hidden
  const start = () => { if (canStart()) { last = 0; raf = requestAnimationFrame(tick) } }
  const stop = () => { cancelAnimationFrame(raf); raf = 0 }

  const ro = new ResizeObserver(layout); ro.observe(host)
  const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; if (visible) start(); else stop() }); io.observe(host)
  const onVis = () => (document.hidden ? stop() : start())
  document.addEventListener("visibilitychange", onVis)
  // pointer paints along its path (segment-interpolated so fast moves leave a continuous trail)
  const onMove = (e: PointerEvent) => {
    const r = host.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top
    const amt = e.pointerType === "touch" ? 0.25 : 0.5
    if (ptr.has) {
      const d = Math.hypot(x - ptr.x, y - ptr.y), n = Math.min(12, Math.ceil(d / 24))
      for (let s = 1; s <= n; s++) splat(ptr.x + ((x - ptr.x) * s) / n, ptr.y + ((y - ptr.y) * s) / n, amt / Math.max(1, n * 0.6))
    } else splat(x, y, amt)
    ptr.x = x; ptr.y = y; ptr.has = true
    start()
  }
  const onLeave = () => { ptr.has = false }
  const live = !reduce && props.interactive
  if (live) { host.addEventListener("pointermove", onMove, { passive: true }); host.addEventListener("pointerleave", onLeave) }
  document.fonts?.ready.then(layout)
  start()
  cleanup = () => {
    stop(); ro.disconnect(); io.disconnect(); document.removeEventListener("visibilitychange", onVis)
    if (live) { host.removeEventListener("pointermove", onMove); host.removeEventListener("pointerleave", onLeave) }
  }
})

onBeforeUnmount(() => cleanup?.())
</script>

<template>
  <div class="tl-ascii" aria-hidden="true">
    <canvas ref="cvRef" class="tl-ascii-cv" />
  </div>
</template>

<style>
.tl-ascii { position: absolute; inset: 0; z-index: 0; overflow: hidden; pointer-events: none; animation: tl-fade 1200ms var(--tl-ease) 200ms both; }
.tl-ascii-cv { position: absolute; inset: 0; width: 100%; height: 100%; }
@keyframes tl-fade { from { opacity: 0; } }
@media (prefers-reduced-motion: reduce) { .tl-ascii { animation: none; } }
</style>
