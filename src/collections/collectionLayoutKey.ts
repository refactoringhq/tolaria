import type { SidebarSelection } from '../types'

export function collectionLayoutKey(selection: SidebarSelection): string {
  if (selection.kind === 'filter') return `builtin:${selection.filter}`
  if (selection.kind === 'sectionGroup') return `type:${selection.type}`
  if (selection.kind === 'folder') return `folder:${selection.path}`
  if (selection.kind === 'view') return `view:${selection.filename}`
  return `neighborhood:${selection.entry.path}`
}
