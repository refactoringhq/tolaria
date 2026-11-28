import type { FolderNode, SidebarSelection } from '../../types'

export const mockFolders: FolderNode[] = [
  {
    name: 'projects',
    path: 'projects',
    children: [
      { name: 'laputa', path: 'projects/laputa', children: [] },
      { name: 'portfolio', path: 'projects/portfolio', children: [] },
    ],
  },
  { name: 'areas', path: 'areas', children: [] },
  { name: 'journal', path: 'journal', children: [] },
]

export const defaultSelection: SidebarSelection = { kind: 'filter', filter: 'all' }
export const vaultRootPath = '/Users/luca/Laputa'
