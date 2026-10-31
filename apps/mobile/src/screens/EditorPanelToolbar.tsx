import type { ComponentProps } from 'react'
import { MobileEditorToolbar } from './MobileEditorToolbar'

type EditorPanelToolbarProps = ComponentProps<typeof MobileEditorToolbar> & {
  hidden: boolean
}

export function EditorPanelToolbar({ hidden, ...props }: EditorPanelToolbarProps) {
  return hidden ? null : <MobileEditorToolbar {...props} />
}
