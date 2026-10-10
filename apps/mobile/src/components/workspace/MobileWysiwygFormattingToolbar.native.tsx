import { useBridgeState, type EditorBridge } from '@10play/tentap-editor'
import type { ComponentProps } from 'react'
import { MobileCompactFormattingToolbar } from './MobileCompactFormattingToolbar'
import { formattingToolbarSelection } from './mobileFormattingToolbarModel'

type Props = Omit<ComponentProps<typeof MobileCompactFormattingToolbar>, 'selected' | 'inTable'> & { editor: EditorBridge }

export function MobileWysiwygFormattingToolbar({ editor, ...props }: Props) {
  const state = useBridgeState(editor)
  const tableState = state as typeof state & { canAddRowAfter?: boolean }
  return <MobileCompactFormattingToolbar {...props} selected={formattingToolbarSelection(state)} inTable={tableState.canAddRowAfter === true} />
}
