import type { CSSProperties, ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { ActionTooltip, type ActionTooltipCopy } from '@/components/ui/action-tooltip'
import { useBreadcrumbTooltipControl } from './breadcrumbTooltip'

interface IconActionButtonProps {
  copy: ActionTooltipCopy
  onClick?: () => void
  className?: string
  style?: CSSProperties
  children: ReactNode
  testId?: string
  tooltipAlign?: 'start' | 'center' | 'end'
}

export function IconActionButton(props: IconActionButtonProps) {
  const { copy, onClick, className, style, children, testId, tooltipAlign = 'end' } = props
  const tooltipControl = useBreadcrumbTooltipControl(copy.label)

  return (
    <ActionTooltip
      copy={copy}
      side="bottom"
      align={tooltipAlign}
      open={tooltipControl.open}
      onOpenChange={tooltipControl.onOpenChange}
    >
      <Button
        type="button"
        variant="ghost"
        size="icon-xs"
        className={cn('text-muted-foreground [&_svg:not([class*=size-])]:size-4', className)}
        style={style}
        onClick={onClick}
        onPointerEnter={tooltipControl.onPointerEnter}
        onPointerLeave={tooltipControl.onPointerLeave}
        onFocus={tooltipControl.onFocus}
        onBlur={tooltipControl.onBlur}
        aria-label={copy.label}
        aria-disabled={onClick ? undefined : true}
        data-testid={testId}
      >
        {children}
      </Button>
    </ActionTooltip>
  )
}
