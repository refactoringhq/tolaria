import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type Dispatch,
  type SetStateAction,
} from 'react'
import type { BreadcrumbOverflowMenuTooltipControl as BreadcrumbTooltipControl } from '../BreadcrumbOverflowMenuTrigger'


export const BREADCRUMB_ICON_CLASS = 'size-[16px]'

export interface BreadcrumbTooltipController {
  activeTooltipLabel: string | null
  setActiveTooltipLabel: Dispatch<SetStateAction<string | null>>
}

export const BreadcrumbTooltipContext = createContext<BreadcrumbTooltipController | null>(null)

function clearBreadcrumbTooltip(controller: BreadcrumbTooltipController, label: string) {
  controller.setActiveTooltipLabel((current) => current === label ? null : current)
}

function setBreadcrumbTooltipOpen(controller: BreadcrumbTooltipController, label: string, open: boolean) {
  if (open) {
    controller.setActiveTooltipLabel(label)
    return
  }
  clearBreadcrumbTooltip(controller, label)
}

export function useBreadcrumbTooltipControl(label: string): BreadcrumbTooltipControl {
  const controller = useContext(BreadcrumbTooltipContext)
  const activate = useCallback(() => {
    controller?.setActiveTooltipLabel(label)
  }, [controller, label])
  const deactivate = useCallback(() => {
    if (!controller) return
    clearBreadcrumbTooltip(controller, label)
  }, [controller, label])
  const onOpenChange = useCallback((open: boolean) => {
    if (!controller) return
    setBreadcrumbTooltipOpen(controller, label, open)
  }, [controller, label])

  if (!controller) {
    return {}
  }

  return {
    open: controller.activeTooltipLabel === label,
    onOpenChange,
    onPointerEnter: activate,
    onPointerLeave: deactivate,
    onFocus: activate,
    onBlur: deactivate,
  }
}

export function useBreadcrumbTooltipController(): BreadcrumbTooltipController {
  const [activeTooltipLabel, setActiveTooltipLabel] = useState<string | null>(null)
  return useMemo(() => ({ activeTooltipLabel, setActiveTooltipLabel }), [activeTooltipLabel])
}
