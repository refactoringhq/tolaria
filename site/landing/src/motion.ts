// Scroll-driven motion without scroll listeners (IntersectionObserver only):
// - .reveal elements rise in once ([data-shown]), then drop their stagger delay ([data-done]) so hovers aren't delayed
// - .loop elements play only while on screen ([data-play]); offscreen they pause where they are
export function startMotion(root: ParentNode = document) {
  const reveal = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (!e.isIntersecting) continue
      const el = e.target as HTMLElement
      el.dataset.shown = ""
      reveal.unobserve(el)
      setTimeout(() => { el.dataset.done = "" }, 1100)
    }
  }, { rootMargin: "0px 0px -48px 0px", threshold: 0.01 })
  root.querySelectorAll<HTMLElement>(".reveal").forEach((el) => reveal.observe(el))

  const loop = new IntersectionObserver((entries) => {
    for (const e of entries) {
      const el = e.target as HTMLElement
      if (e.isIntersecting) el.dataset.play = ""
      else delete el.dataset.play
    }
  }, { threshold: 0.25 })
  root.querySelectorAll<HTMLElement>(".loop").forEach((el) => loop.observe(el))


  return () => { reveal.disconnect(); loop.disconnect() }
}

export const reducedMotion = () => matchMedia("(prefers-reduced-motion: reduce)").matches
