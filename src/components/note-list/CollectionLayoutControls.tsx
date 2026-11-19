import { Columns } from '@phosphor-icons/react'
import type { ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import type { CalendarSettings, CollectionPresentationType } from '../../collections/collectionTypes'
import { getCollectionLayout, getCollectionLayouts } from '../../collections/layoutRegistry'
import { type AppLocale, translate } from '../../lib/i18n'
import { CalendarDateMenu } from './calendar/CalendarDateMenu'
import { GraphFilterMenu, type GraphFilterMenuProps } from './graph/GraphFilterMenu'

interface HeaderMenuProps {
  label: string
  triggerClassName?: string
  testId: string
  icon: ReactNode
  value: string
  onValueChange: (value: string) => void
  children: ReactNode
}

function HeaderRadioMenu({ label, triggerClassName, testId, icon, value, onValueChange, children }: HeaderMenuProps) {
  return (
    // Non-modal like the Linux menu bar: the modal scroll lock shifts the whole WebKitGTK window while open.
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <Button type="button" variant="ghost" size="icon-xs" className={triggerClassName} title={label} aria-label={label} data-testid={testId}>
          {icon}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-40">
        <DropdownMenuRadioGroup value={value} onValueChange={onValueChange}>
          {children}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export interface LayoutMenuProps {
  layout: CollectionPresentationType
  locale: AppLocale
  triggerClassName?: string
  onChange: (layout: CollectionPresentationType) => void
}

export function LayoutMenu({ layout, locale, triggerClassName, onChange }: LayoutMenuProps) {
  const current = getCollectionLayout(layout)
  const CurrentIcon = current.icon
  return (
    <HeaderRadioMenu
      label={translate(locale, 'layout.current', { layout: translate(locale, current.labelKey) })}
      triggerClassName={triggerClassName}
      testId="layout-menu-button"
      icon={<CurrentIcon size={16} />}
      value={layout}
      onValueChange={(value) => onChange(getCollectionLayout(value as CollectionPresentationType).type)}
    >
      <DropdownMenuLabel className="text-xs text-muted-foreground">{translate(locale, 'layout.label')}</DropdownMenuLabel>
      {getCollectionLayouts().map(({ type, labelKey, descriptionKey, icon: Icon }) => (
        <DropdownMenuRadioItem key={type} value={type} title={translate(locale, descriptionKey)} data-testid={`layout-option-${type}`}>
          <Icon size={14} />
          {translate(locale, labelKey)}
        </DropdownMenuRadioItem>
      ))}
    </HeaderRadioMenu>
  )
}

export interface GroupByMenuProps {
  groupBy: string
  groups: string[]
  locale: AppLocale
  triggerClassName?: string
  onChange: (property: string) => void
}

export function GroupByMenu({ groupBy, groups, locale, triggerClassName, onChange }: GroupByMenuProps) {
  const options = groups.includes(groupBy) ? groups : [groupBy, ...groups]
  return (
    <HeaderRadioMenu
      label={translate(locale, 'layout.groupByProperty', { property: groupBy })}
      triggerClassName={triggerClassName}
      testId="group-by-menu-button"
      icon={<Columns size={16} />}
      value={groupBy}
      onValueChange={onChange}
    >
      <DropdownMenuLabel className="text-xs text-muted-foreground">{translate(locale, 'layout.groupBy')}</DropdownMenuLabel>
      {options.map((property) => (
        <DropdownMenuRadioItem key={property} value={property} data-testid={`group-by-option-${property}`}>
          {property}
        </DropdownMenuRadioItem>
      ))}
    </HeaderRadioMenu>
  )
}

export interface CalendarHeaderControls {
  settings: CalendarSettings
  dateProperty: string | null
  dateOptions: string[]
  onChange: (patch: Partial<CalendarSettings>) => void
}

export type GraphHeaderControls = Omit<GraphFilterMenuProps, 'locale' | 'triggerClassName'>

export interface CollectionLayoutHeaderControlsProps {
  layout: CollectionPresentationType
  groupBy: string
  groups: string[]
  calendar: CalendarHeaderControls
  /** Graph legend and filters; absent where the list can't show a graph. */
  graph?: GraphHeaderControls
  locale: AppLocale
  triggerClassName?: string
  onLayoutChange: (layout: CollectionPresentationType) => void
  onGroupByChange: (property: string) => void
}

export function CollectionLayoutHeaderControls(props: CollectionLayoutHeaderControlsProps) {
  const { layout, groupBy, groups, calendar, graph, locale, triggerClassName, onLayoutChange, onGroupByChange } = props
  const { controls } = getCollectionLayout(layout)
  return (
    <>
      <LayoutMenu layout={layout} locale={locale} triggerClassName={triggerClassName} onChange={onLayoutChange} />
      {controls.includes('groupBy') && <GroupByMenu groupBy={groupBy} groups={groups} locale={locale} triggerClassName={triggerClassName} onChange={onGroupByChange} />}
      {controls.includes('dateProperty') && <CalendarDateMenu {...calendar} locale={locale} triggerClassName={triggerClassName} />}
      {controls.includes('graphFilters') && graph && <GraphFilterMenu {...graph} locale={locale} triggerClassName={triggerClassName} />}
    </>
  )
}
