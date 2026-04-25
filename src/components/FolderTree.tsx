import {
  memo,
  useCallback,
} from 'react'
import { useTranslation } from 'react-i18next'
import {
  Plus,
} from '@phosphor-icons/react'
import { Button } from '@/components/ui/button'
import type { FolderNode, SidebarSelection } from '../types'
import { FolderContextMenu } from './folder-tree/FolderContextMenu'
import { FolderNameInput } from './folder-tree/FolderNameInput'
import { FolderTreeRow } from './folder-tree/FolderTreeRow'
import { useFolderContextMenu } from './folder-tree/useFolderContextMenu'
import { useFolderTreeDisclosure } from './folder-tree/useFolderTreeDisclosure'
import { SidebarGroupHeader } from './sidebar/SidebarGroupHeader'

interface FolderTreeProps {
  folders: FolderNode[]
  selection: SidebarSelection
  onSelect: (selection: SidebarSelection) => void
  onCreateFolder?: (name: string) => Promise<boolean> | boolean
  onRenameFolder?: (folderPath: string, nextName: string) => Promise<boolean> | boolean
  onDeleteFolder?: (folderPath: string) => void
  renamingFolderPath?: string | null
  onStartRenameFolder?: (folderPath: string) => void
  onCancelRenameFolder?: () => void
  collapsed?: boolean
  onToggle?: () => void
}

export const FolderTree = memo(function FolderTree({
  folders,
  selection,
  onSelect,
  onCreateFolder,
  onRenameFolder,
  onDeleteFolder,
  renamingFolderPath,
  onStartRenameFolder,
  onCancelRenameFolder,
  collapsed: externalCollapsed,
  onToggle,
}: FolderTreeProps) {
  const {
    closeCreateForm,
    expanded,
    handleToggleSection,
    isCreating,
    openCreateForm,
    sectionCollapsed,
    toggleFolder,
  } = useFolderTreeDisclosure({
    collapsed: externalCollapsed,
    onToggle,
    renamingFolderPath,
    selection,
  })
  const {
    closeContextMenu,
    contextMenu,
    handleDeleteFromMenu,
    handleOpenMenu,
    handleRenameFromMenu,
    menuRef,
  } = useFolderContextMenu({
    onDeleteFolder,
    onStartRenameFolder,
  })

  const handleCreateFolderSubmit = useCallback(async (value: string) => {
    const nextName = value.trim()
    if (!nextName || !onCreateFolder) {
      closeCreateForm()
      return true
    }

    const created = await onCreateFolder(nextName)
    if (created) closeCreateForm()
    return created
  }, [closeCreateForm, onCreateFolder])

  const { t } = useTranslation('sidebar')

  if (folders.length === 0 && !isCreating) return null

  return (
    <div className="border-b border-border" style={{ padding: '0 6px' }}>
      <SidebarGroupHeader label={t('FOLDERS')} collapsed={sectionCollapsed} onToggle={handleToggleSection}>
        {onCreateFolder && (
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            className="h-auto w-auto min-w-0 rounded-none p-0 text-muted-foreground hover:bg-transparent hover:text-foreground"
            data-testid="create-folder-btn"
            title={t('Create folder')}
            aria-label={t('Create folder')}
            onClick={(event) => {
              event.stopPropagation()
              closeContextMenu()
              openCreateForm()
            }}
          >
            <Plus size={12} className="text-muted-foreground hover:text-foreground" />
          </Button>
        )}
      </SidebarGroupHeader>
      {!sectionCollapsed && (
        <div className="flex flex-col gap-0.5 pb-2">
          {folders.map((node) => (
            <FolderTreeRow
              key={node.path}
              depth={0}
              expanded={expanded}
              node={node}
              onDeleteFolder={onDeleteFolder}
              onOpenMenu={handleOpenMenu}
              onRenameFolder={onRenameFolder}
              onSelect={onSelect}
              onStartRenameFolder={onStartRenameFolder}
              onToggle={toggleFolder}
              onCancelRenameFolder={onCancelRenameFolder}
              renamingFolderPath={renamingFolderPath}
              selection={selection}
            />
          ))}
          {isCreating && (
            <div style={{ paddingLeft: 8 }}>
              <FolderNameInput
                ariaLabel={t('New folder name')}
                initialValue=""
                placeholder={t('Folder name')}
                submitOnBlur={true}
                testId="new-folder-input"
                onCancel={closeCreateForm}
                onSubmit={handleCreateFolderSubmit}
              />
            </div>
          )}
        </div>
      )}
      <FolderContextMenu
        menu={contextMenu}
        menuRef={menuRef}
        onDelete={handleDeleteFromMenu}
        onRename={handleRenameFromMenu}
      />
    </div>
  )
})
