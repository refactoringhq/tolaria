import type { VaultEntry } from '../types'

/**
 * Decides whether a vault entry can appear as a kanban card.
 *
 * Excluded:
 * - Binary files (images, attachments) — not editable as a "task" note.
 * - View definition YAMLs (`views/*.yml`) — these are the kanban configs themselves,
 *   not notes. Including them allowed a self-referential drag where the YAML got
 *   `update_frontmatter`-ed and corrupted (lost `kind: kanban`, board disappeared).
 */
export function isKanbanEligibleEntry(entry: VaultEntry): boolean {
  if (entry.fileKind === 'binary') return false
  if (isViewDefinitionPath(entry.path)) return false
  return true
}

function isViewDefinitionPath(path: string): boolean {
  if (!path.endsWith('.yml') && !path.endsWith('.yaml')) return false
  return path.startsWith('views/') || path.includes('/views/')
}
