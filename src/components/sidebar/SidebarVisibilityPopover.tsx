import type { VaultEntry, WorkspaceIdentity } from '../../types'
import type { SectionGroup } from '../SidebarParts'
import { getTypeColor } from '../../utils/typeColors'
import { collectTypeVisibilityWorkspaces, findTypeDefinitionForWorkspace } from '../../utils/typeVisibility'
import { translate, type AppLocale } from '../../lib/i18n'
import { Button } from '../ui/button'
import { Checkbox } from '../ui/checkbox'
import { WorkspaceInitialsBadge } from '../WorkspaceInitialsBadge'

type VisibilityToggleHandler = (type: string, typeEntryPath?: string) => void

interface VisibilityPopoverItemProps {
  group: SectionGroup
  isVisible: boolean
  onToggle: VisibilityToggleHandler
  locale?: AppLocale
}

interface VisibilityMatrixHeaderProps {
  workspaces: WorkspaceIdentity[]
}

interface VisibilityMatrixCellProps {
  group: SectionGroup
  typeEntry: VaultEntry | null
  workspace: WorkspaceIdentity
  onToggle: VisibilityToggleHandler
  locale: AppLocale
}

interface VisibilityMatrixRowProps {
  entries: VaultEntry[]
  group: SectionGroup
  locale: AppLocale
  onToggle: VisibilityToggleHandler
  workspaces: WorkspaceIdentity[]
}

interface VisibilityMatrixPopoverProps {
  entries: VaultEntry[]
  locale: AppLocale
  onToggle: VisibilityToggleHandler
  sections: SectionGroup[]
  workspaces: WorkspaceIdentity[]
}

interface VisibilityPopoverProps {
  entries: VaultEntry[]
  sections: SectionGroup[]
  isSectionVisible: (type: string) => boolean
  onToggle: VisibilityToggleHandler
  workspaceOrder?: readonly string[]
  locale?: AppLocale
}

interface ToggleSwitchProps {
  on: boolean
}

function VisibilityPopoverItem({
  group,
  isVisible,
  onToggle,
  locale = 'en',
}: VisibilityPopoverItemProps) {
  const { label, type, Icon, customColor } = group
  const sectionColor = getTypeColor(type, customColor)

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className="h-auto w-full justify-start rounded-none px-3 py-1.5"
      style={{ padding: '6px 12px', gap: 8 }}
      onClick={() => onToggle(type)}
      aria-label={translate(locale, 'sidebar.section.toggle', { label })}
    >
      <Icon size={14} style={{ color: sectionColor }} />
      <span className="flex-1 text-left text-[13px] text-foreground">{label}</span>
      <ToggleSwitch on={isVisible} />
    </Button>
  )
}

function VisibilityMatrixHeader({ workspaces }: VisibilityMatrixHeaderProps) {
  return (
    <div
      className="grid items-center gap-2 px-3 pb-1"
      style={{
        gridTemplateColumns: `minmax(96px, 1fr) repeat(${workspaces.length}, 28px)`,
      }}
    >
      <div />
      {workspaces.map((workspace) => (
        <div key={workspace.path} className="flex justify-center">
          <WorkspaceInitialsBadge workspace={workspace} />
        </div>
      ))}
    </div>
  )
}

function VisibilityMatrixCell({
  group,
  typeEntry,
  workspace,
  onToggle,
  locale,
}: VisibilityMatrixCellProps) {
  if (!typeEntry) {
    return <span aria-hidden="true" className="mx-auto h-px w-3 bg-border" />
  }

  return (
    <Checkbox
      checked={typeEntry.visible !== false}
      onCheckedChange={() => onToggle(group.type, typeEntry.path)}
      aria-label={translate(locale, 'sidebar.section.toggle', {
        label: `${group.label} ${workspace.shortLabel}`,
      })}
      className="mx-auto"
    />
  )
}

function VisibilityMatrixRow({
  entries,
  group,
  locale,
  onToggle,
  workspaces,
}: VisibilityMatrixRowProps) {
  const { label, type, Icon, customColor } = group
  const sectionColor = getTypeColor(type, customColor)

  return (
    <div
      className="grid items-center gap-2 px-3 py-1.5"
      style={{
        gridTemplateColumns: `minmax(96px, 1fr) repeat(${workspaces.length}, 28px)`,
      }}
    >
      <div className="flex min-w-0 items-center gap-2">
        <Icon size={14} style={{ color: sectionColor }} />
        <span className="min-w-0 truncate text-left text-[13px] text-foreground">{label}</span>
      </div>
      {workspaces.map((workspace) => (
        <VisibilityMatrixCell
          key={workspace.path}
          group={group}
          typeEntry={findTypeDefinitionForWorkspace(entries, type, workspace.path)}
          workspace={workspace}
          onToggle={onToggle}
          locale={locale}
        />
      ))}
    </div>
  )
}

function VisibilityMatrixPopover({
  entries,
  locale,
  onToggle,
  sections,
  workspaces,
}: VisibilityMatrixPopoverProps) {
  return (
    <>
      <VisibilityMatrixHeader workspaces={workspaces} />
      {sections.map((group) => (
        <VisibilityMatrixRow
          key={group.type}
          entries={entries}
          group={group}
          locale={locale}
          onToggle={onToggle}
          workspaces={workspaces}
        />
      ))}
    </>
  )
}

// --- Visibility Popover ---

export function VisibilityPopover({
  entries,
  sections,
  isSectionVisible,
  onToggle,
  workspaceOrder = [],
  locale = 'en',
}: VisibilityPopoverProps) {
  const workspaces = collectTypeVisibilityWorkspaces(entries, workspaceOrder)
  const showMatrix = workspaces.length > 1

  return (
    <div
      className="border border-border bg-popover text-popover-foreground"
      style={{
        position: 'absolute',
        top: '100%',
        left: 6,
        right: 6,
        zIndex: 50,
        borderRadius: 8,
        padding: '8px 0',
        boxShadow: '0 4px 12px var(--shadow-dialog)',
      }}
    >
      <div className="text-[12px] font-semibold text-muted-foreground" style={{ padding: '0 12px 4px' }}>
        {translate(locale, 'sidebar.section.showInSidebar')}
      </div>
      {showMatrix ? (
        <VisibilityMatrixPopover
          entries={entries}
          locale={locale}
          onToggle={onToggle}
          sections={sections}
          workspaces={workspaces}
        />
      ) : (
        sections.map((group) => (
          <VisibilityPopoverItem
            key={group.type}
            group={group}
            isVisible={isSectionVisible(group.type)}
            onToggle={onToggle}
            locale={locale}
          />
        ))
      )}
    </div>
  )
}

function ToggleSwitch({ on }: ToggleSwitchProps) {
  return (
    <div
      className="flex items-center"
      style={{
        width: 32,
        height: 18,
        borderRadius: 9,
        padding: 2,
        backgroundColor: on ? 'var(--primary)' : 'var(--muted)',
        justifyContent: on ? 'flex-end' : 'flex-start',
        transition: 'background-color 150ms',
      }}
    >
      <div
        style={{
          width: 14,
          height: 14,
          borderRadius: 7,
          backgroundColor: 'var(--background)',
          transition: 'transform 150ms',
        }}
      />
    </div>
  )
}
