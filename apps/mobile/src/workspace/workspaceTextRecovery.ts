import { optionalNativeWorkspaceAccessModule } from './nativeWorkspaceAccess'

type NativeTextRecovery = {
  writeWorkspaceText?: (root: string, path: string, content: string) => Promise<void>
  recoverWorkspaceText?: (root: string) => boolean
}

export function writeNativeWorkspaceText(
  root: string, path: string, content: string,
  module: NativeTextRecovery | null = optionalNativeWorkspaceAccessModule(),
): Promise<void> | null {
  if (!module) return null
  if (!module.writeWorkspaceText) throw new Error('nativeTextRecoveryUnavailable')
  return module.writeWorkspaceText(root, path, content)
}

export function recoverNativeWorkspaceText(
  root: string,
  module: NativeTextRecovery | null = optionalNativeWorkspaceAccessModule(),
): boolean {
  if (!root.startsWith('file:')) return false
  if (!module) return false
  if (!module.recoverWorkspaceText) throw new Error('nativeTextRecoveryUnavailable')
  return module.recoverWorkspaceText(root)
}
