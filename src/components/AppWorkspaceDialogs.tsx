import type { ComponentProps } from 'react'
import type { useMcpSetupDialogController } from '../hooks/useMcpSetupDialogController'
import type { AppLocale } from '../lib/i18n'
import { CloneVaultModal } from './CloneVaultModal'
import { ConfirmDeleteDialog } from './ConfirmDeleteDialog'
import { FeedbackDialog } from './FeedbackDialog'
import { McpSetupDialog } from './McpSetupDialog'

interface WorkspaceMcpDialogProps {
  enabled: boolean
  controller: ReturnType<typeof useMcpSetupDialogController>
  locale: AppLocale
}

function WorkspaceMcpDialog({ enabled, controller, locale }: WorkspaceMcpDialogProps) {
  if (!enabled) return null
  return (
    <McpSetupDialog
      open={controller.open}
      status={controller.status}
      busyAction={controller.busyAction}
      manualConfigSnippet={controller.manualConfigSnippet}
      opencodeManualConfigSnippet={controller.opencodeManualConfigSnippet}
      manualConfigLoading={controller.manualConfigLoading}
      manualConfigError={controller.manualConfigError}
      locale={locale}
      onClose={controller.closeDialog}
      onConnect={controller.connect}
      onCopyManualConfig={controller.copyManualConfig}
      onCopyOpenCodeManualConfig={controller.copyOpenCodeManualConfig}
      onDisconnect={controller.disconnect}
      onLoadManualConfig={controller.loadManualConfig}
    />
  )
}

type DeleteDialogProps = ComponentProps<typeof ConfirmDeleteDialog>
interface WorkspaceDeleteDialogProps {
  confirmation: Pick<DeleteDialogProps, 'title' | 'message' | 'confirmLabel'> | null
  onConfirm: DeleteDialogProps['onConfirm']
  onCancel: DeleteDialogProps['onCancel']
}

function WorkspaceDeleteDialog({ confirmation, onConfirm, onCancel }: WorkspaceDeleteDialogProps) {
  if (!confirmation) return null
  return <ConfirmDeleteDialog {...confirmation} open onConfirm={onConfirm} onCancel={onCancel} />
}

interface AppWorkspaceDialogsProps {
  clone: ComponentProps<typeof CloneVaultModal>
  feedback: ComponentProps<typeof FeedbackDialog>
  mcp: WorkspaceMcpDialogProps
  noteDelete: WorkspaceDeleteDialogProps
  folderDelete: WorkspaceDeleteDialogProps
}

export function AppWorkspaceDialogs({ clone, feedback, mcp, noteDelete, folderDelete }: AppWorkspaceDialogsProps) {
  return (
    <>
      <FeedbackDialog {...feedback} />
      <WorkspaceMcpDialog {...mcp} />
      <CloneVaultModal key={clone.open ? 'clone-open' : 'clone-closed'} {...clone} />
      <WorkspaceDeleteDialog {...noteDelete} />
      <WorkspaceDeleteDialog {...folderDelete} />
    </>
  )
}
