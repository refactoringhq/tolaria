/**
 * Merge open tab content into the allContent dictionary.
 * Tab content takes priority (it reflects the current editor state).
 * Returns the original object if no changes are needed (stable reference for useMemo).
 */
export function mergeTabContent(
  allContent: Record<string, string>,
  tabs: ReadonlyArray<{ entry: { path: string }; content: string }>,
): Record<string, string> {
  let merged: Record<string, string> | null = null
  for (const tab of tabs) {
    if (!tab.content) continue
    if (allContent[tab.entry.path] === tab.content) continue
    if (!merged) merged = { ...allContent }
    merged[tab.entry.path] = tab.content
  }
  return merged ?? allContent
}
