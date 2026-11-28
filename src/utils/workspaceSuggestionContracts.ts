/** Suggested keys use the vault's lowercase snake_case naming, for keys and labels alike (TOL-466). */
export const SUGGESTED_PROPERTY_SLOTS = [
  { key: 'status', label: 'status' },
  { key: 'date', label: 'date' },
  { key: 'url', label: 'url' },
  { key: 'icon', label: 'icon' },
] as const

export const SUGGESTED_PROPERTY_KEYS = SUGGESTED_PROPERTY_SLOTS.map((slot) => slot.key)

export const SUGGESTED_RELATIONSHIP_KEYS = ['belongs_to', 'related_to', 'has'] as const

export const SAVED_VIEW_BUILT_IN_FIELDS = [
  'type',
  'status',
  'title',
  'favorite',
  'body',
  'filename',
  'archived',
  'tags',
] as const
