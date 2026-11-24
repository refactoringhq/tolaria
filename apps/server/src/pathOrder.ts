/** The order of indexed items: `localeCompare` of their paths, with a reusable collator. */
const compare = new Intl.Collator().compare

interface Pathed {
  path: string
}

export function sortByPath<T extends Pathed>(items: T[]): T[] {
  return items.sort((a, b) => compare(a.path, b.path))
}

/** Removes the item at `path` from a list sorted by path. True when there was one. */
export function removeByPath<T extends Pathed>(items: T[], path: string): boolean {
  const index = items.findIndex((item) => item.path === path)
  if (index < 0) return false
  items.splice(index, 1)
  return true
}

/** Puts `item` in a list sorted by path, replacing the one at its path: no full re-sort. */
export function putByPath<T extends Pathed>(items: T[], item: T): void {
  removeByPath(items, item.path)
  let low = 0
  let high = items.length
  while (low < high) {
    const middle = (low + high) >>> 1
    if (compare(items[middle].path, item.path) < 0) low = middle + 1
    else high = middle
  }
  items.splice(low, 0, item)
}
