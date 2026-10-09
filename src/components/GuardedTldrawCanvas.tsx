import type { ComponentProps } from 'react'
import { DefaultCanvas, useEditor } from 'tldraw'
import { installTldrawTextMeasurementGuard } from './tldrawTextMeasurementGuard'

type TldrawCanvasProps = ComponentProps<typeof DefaultCanvas>

export function GuardedTldrawCanvas(props: TldrawCanvasProps) {
  const editor = useEditor()
  installTldrawTextMeasurementGuard(editor)
  return <DefaultCanvas {...props} />
}
