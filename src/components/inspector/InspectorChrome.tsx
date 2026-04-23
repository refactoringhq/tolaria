import { SlidersHorizontal, X, Sparkle, WarningCircle, PencilSimple } from '@phosphor-icons/react'
import { useDragRegion } from '../../hooks/useDragRegion'
import { t } from '../../lib/i18n'

export function InspectorHeader({ collapsed, onToggle }: { collapsed: boolean; onToggle: () => void }) {
  const { onMouseDown } = useDragRegion()

  return (
    <div
      className="flex shrink-0 items-center border-b border-border"
      style={{ height: 52, padding: '6px 12px', gap: 8, cursor: 'default' }}
      onMouseDown={onMouseDown}
    >
      {collapsed ? (
        <button
          className="shrink-0 border-none bg-transparent p-1 text-muted-foreground cursor-pointer hover:text-foreground"
          onClick={onToggle}
          title={t('Properties (⌘⇧I)')}
        >
          <SlidersHorizontal size={16} />
        </button>
      ) : (
        <>
          <SlidersHorizontal size={16} className="shrink-0 text-muted-foreground" />
          <span className="flex-1 text-muted-foreground" style={{ fontSize: 13, fontWeight: 600 }}>{t('Properties')}</span>
          <button
            className="shrink-0 border-none bg-transparent p-1 text-muted-foreground cursor-pointer hover:text-foreground"
            onClick={onToggle}
            title={t('Close Properties (⌘⇧I)')}
          >
            <X size={16} />
          </button>
        </>
      )}
    </div>
  )
}

export function EmptyInspector() {
  return <div><p className="m-0 text-[13px] text-muted-foreground">{t('No note selected')}</p></div>
}

export function InitializePropertiesPrompt({ onClick }: { onClick: () => void }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-border px-4 py-6">
      <Sparkle size={24} className="text-muted-foreground" />
      <p className="m-0 text-center text-[13px] text-muted-foreground">{t('This note has no properties yet')}</p>
      <button
        className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-border bg-background px-3 py-1.5 text-[13px] font-medium text-foreground transition-colors hover:bg-muted"
        onClick={onClick}
      >
        {t('Initialize properties')}
      </button>
    </div>
  )
}

export function InvalidFrontmatterNotice({ onFix }: { onFix: () => void }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-destructive/40 bg-destructive/5 px-4 py-6">
      <WarningCircle size={24} className="text-destructive" />
      <p className="m-0 text-center text-[13px] text-muted-foreground">{t('Invalid properties')}</p>
      <button
        className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-border bg-background px-3 py-1.5 text-[13px] font-medium text-foreground transition-colors hover:bg-muted"
        onClick={onFix}
      >
        <PencilSimple size={14} />
        {t('Fix in editor')}
      </button>
    </div>
  )
}
