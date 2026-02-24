/** Fuzzy match: all query chars must appear in order in the target. */
export function fuzzyMatch(query: string, target: string): { match: boolean; score: number } {
  const q = query.toLowerCase()
  const t = target.toLowerCase()
  let qi = 0
  let score = 0
  let lastMatchIndex = -1

  for (let ti = 0; ti < t.length && qi < q.length; ti++) {
    if (t[ti] === q[qi]) {
      if (ti === lastMatchIndex + 1) score += 2
      if (ti === 0 || t[ti - 1] === ' ' || t[ti - 1] === '-') score += 3
      score += 1
      lastMatchIndex = ti
      qi++
    }
  }

  return { match: qi === q.length, score }
}
