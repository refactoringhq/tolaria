import { mobileText } from '../../i18n/mobileText'
import { showNativeTextPrompt, submitPromptValueAfterStateUpdate } from '../ui/mobileNativeDialogs'
import type { MobileWorkspaceActionSheetProps } from './MobileWorkspaceActionSheet.types'

export function showNativeFolderRenamePrompt(props: MobileWorkspaceActionSheetProps) {
  showNativeTextPrompt({
    cancelLabel: mobileText('common.cancel'),
    defaultValue: props.folderName,
    onCancel: () => undefined,
    onSubmit: (value) => submitPromptValueAfterStateUpdate(value, props.onFolderNameChange, props.onRenameFolder),
    submitLabel: mobileText('common.save'),
    title: mobileText('sidebar.action.renameFolder'),
    validate: (value) => validateFolderRename(props, value),
  })
}

function validateFolderRename(props: MobileWorkspaceActionSheetProps, value: string) {
  const name = value.trim()
  if (!name) return mobileText('workspace.action.nameAlreadyExists')
  const segments = props.folderPath.split('/').filter(Boolean)
  segments[segments.length - 1] = name
  const candidate = segments.join('/').toLocaleLowerCase()
  return props.folderPaths?.some(path => path !== props.folderPath && path.toLocaleLowerCase() === candidate)
    ? mobileText('workspace.action.nameAlreadyExists')
    : null
}
