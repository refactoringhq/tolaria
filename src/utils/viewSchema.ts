export type FilterOp =
  | 'after'
  | 'any_of'
  | 'before'
  | 'contains'
  | 'equals'
  | 'is_empty'
  | 'is_not_empty'
  | 'none_of'
  | 'not_contains'
  | 'not_equals'

export interface FilterCondition {
  field: string
  op: FilterOp
  regex?: boolean
  value?: unknown
}

export type FilterGroup = { all: FilterNode[] } | { any: FilterNode[] }
export type FilterNode = FilterCondition | FilterGroup

export interface ViewDefinition {
  name: string
  icon: string | null
  color: string | null
  /** Display order for saved Views in sidebar/list surfaces (lower = higher). */
  order?: number | null
  sort: string | null
  listPropertiesDisplay?: string[]
  filters: FilterGroup
  presentation?: {
    type: 'list' | 'kanban' | 'calendar'
    sort?: string | null
    groupBy?: string | null
    properties?: string[]
    columnOrder?: string[]
    collapsedColumns?: string[]
    hiddenColumns?: string[]
    dateProperty?: string | null
    endDateProperty?: string | null
    view?: 'month' | 'week'
    showWeekends?: boolean
  }
}

export interface ViewFileCore {
  filename: string
  definition: ViewDefinition
}
