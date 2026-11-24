import type { SidebarSelection } from '../types'

type SavedViewSelection = Extract<SidebarSelection, { kind: 'view' }>

function isViewSelectionActive(current: SavedViewSelection, check: SavedViewSelection) {
  return current.filename === check.filename && (current.rootPath ?? '') === (check.rootPath ?? '')
}

export function isSelectionActive(current: SidebarSelection, check: SidebarSelection): boolean {
  if (current.kind !== check.kind) return false
  switch (check.kind) {
    case 'filter':
      return (current as typeof check).filter === check.filter
    case 'sectionGroup':
      return (current as typeof check).type === check.type
    case 'folder':
      return (current as typeof check).path === check.path
    case 'entity':
      return (current as typeof check).entry.path === check.entry.path
    case 'view':
      return isViewSelectionActive(current as SavedViewSelection, check)
    default:
      return false
  }
}
