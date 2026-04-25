import type { RefObject } from 'react'
import { useTranslation } from 'react-i18next'
import { PencilSimple, Trash } from '@phosphor-icons/react'
import { Button } from '@/components/ui/button'

export interface FolderContextMenuState {
  path: string
  x: number
  y: number
}

interface FolderContextMenuProps {
  menu: FolderContextMenuState | null
  menuRef: RefObject<HTMLDivElement | null>
  onDelete?: (folderPath: string) => void
  onRename: (folderPath: string) => void
}

export function FolderContextMenu({
  menu,
  menuRef,
  onDelete,
  onRename,
}: FolderContextMenuProps) {
  const { t } = useTranslation('sidebar')
  if (!menu) return null

  return (
    <div
      ref={menuRef}
      className="fixed z-50 rounded-md border bg-popover p-1 shadow-md"
      style={{ left: menu.x, top: menu.y, minWidth: 180 }}
      data-testid="folder-context-menu"
    >
      <Button
        type="button"
        variant="ghost"
        className="h-auto w-full justify-start gap-2 px-2 py-1.5 text-sm"
        onClick={() => onRename(menu.path)}
      >
        <PencilSimple size={14} />
        {t('Rename folder...')}
      </Button>
      <Button
        type="button"
        variant="ghost"
        className="h-auto w-full justify-start gap-2 px-2 py-1.5 text-sm text-destructive hover:text-destructive"
        onClick={() => onDelete?.(menu.path)}
        data-testid="delete-folder-menu-item"
      >
        <Trash size={14} />
        {t('Delete folder...')}
      </Button>
    </div>
  )
}
