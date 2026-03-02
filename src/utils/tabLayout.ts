/** Compute per-tab max-width so all tabs fit within the container. */
export function computeTabMaxWidth(containerWidth: number, tabCount: number): number {
  if (tabCount === 0) return 360
  return Math.max(60, Math.min(360, Math.floor(containerWidth / tabCount)))
}
