import { ArrowDown, ArrowUp, Plus, Trash } from '@phosphor-icons/react'
import type { ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { GraphColorGroup, GraphSettings } from '../../../collections/collectionTypes'
import { type AppLocale, type TranslationKey, translate } from '../../../lib/i18n'
import { AccentColorPicker } from '../../AccentColorPicker'
import { movedGroup, newGroup, replaced } from './graphGroups'
import { SettingsSection } from './GraphSettingsSection'
import { useDraftText } from './useDraftText'

interface GroupsProps {
  settings: GraphSettings
  locale: AppLocale
  onChange: (patch: Partial<GraphSettings>) => void
  onPreview: (patch: Partial<GraphSettings>) => void
}

interface GroupRowProps extends GroupsProps {
  group: GraphColorGroup
  index: number
}

function IconAction({ labelKey, locale, testId, disabled, onClick, children }: { labelKey: TranslationKey; locale: AppLocale; testId: string; disabled?: boolean; onClick: () => void; children: ReactNode }) {
  const label = translate(locale, labelKey)
  return (
    <Button type="button" variant="ghost" size="icon-xs" className="text-muted-foreground" title={label} aria-label={label} disabled={disabled} data-testid={testId} onClick={onClick}>
      {children}
    </Button>
  )
}

function GroupRow({ group, index, settings, locale, onChange, onPreview }: GroupRowProps) {
  const groups = settings.colorGroups
  const query = useDraftText(
    group.query,
    (next) => onPreview({ colorGroups: replaced(groups, index, { query: next }) }),
    (next) => onChange({ colorGroups: replaced(groups, index, { query: next }) }),
  )
  return (
    <div className="flex flex-col gap-1.5 rounded-md border border-border p-2" data-testid="graph-group">
      <div className="flex items-center gap-1">
        <Input
          value={query.value}
          placeholder={translate(locale, 'graph.settings.groupQuery')}
          aria-label={translate(locale, 'graph.settings.groupQuery')}
          className="h-7 flex-1 px-2 text-[13px]"
          data-testid="graph-group-query"
          onChange={(event) => query.change(event.target.value)}
          onBlur={query.flush}
        />
        <IconAction labelKey="graph.settings.moveUp" locale={locale} testId="graph-group-up" disabled={index === 0} onClick={() => onChange({ colorGroups: movedGroup(groups, index, -1) })}>
          <ArrowUp size={14} />
        </IconAction>
        <IconAction labelKey="graph.settings.moveDown" locale={locale} testId="graph-group-down" disabled={index === groups.length - 1} onClick={() => onChange({ colorGroups: movedGroup(groups, index, 1) })}>
          <ArrowDown size={14} />
        </IconAction>
        <IconAction labelKey="graph.settings.deleteGroup" locale={locale} testId="graph-group-delete" onClick={() => onChange({ colorGroups: groups.filter((_, position) => position !== index) })}>
          <Trash size={14} />
        </IconAction>
      </div>
      <AccentColorPicker
        size={14}
        className="gap-1.5"
        selectedColor={group.color}
        getOptionTestId={(key) => `graph-group-color-${key}`}
        onSelectColor={(color) => onChange({ colorGroups: replaced(groups, index, { color }) })}
      />
    </div>
  )
}

/** Color groups: a query and a color each, in priority order; type colors apply where no group matches. */
export function GraphGroupsSection(props: GroupsProps) {
  const { settings, locale, onChange } = props
  const add = (
    <Button type="button" variant="ghost" size="xs" data-testid="graph-group-add" onClick={() => onChange({ colorGroups: [...settings.colorGroups, newGroup(settings.colorGroups)] })}>
      <Plus size={12} />
      {translate(locale, 'graph.settings.newGroup')}
    </Button>
  )
  return (
    <SettingsSection title={translate(locale, 'graph.settings.groups')} action={add}>
      {settings.colorGroups.length === 0 && <p className="m-0 text-xs text-muted-foreground">{translate(locale, 'graph.settings.groupsHint')}</p>}
      {settings.colorGroups.map((group, index) => <GroupRow key={group.id} group={group} index={index} {...props} />)}
    </SettingsSection>
  )
}
