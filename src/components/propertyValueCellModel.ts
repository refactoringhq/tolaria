import { isValidCssColor } from '../utils/colorUtils'
import { canonicalSystemMetadataKey } from '../utils/systemMetadata'
import { isUrlValue } from '../utils/url'
import type { AppLocale } from '../lib/i18n'
import type { PropertyDisplayMode } from '../utils/propertyTypes'
import type { FrontmatterValue } from './Inspector'

export interface SmartCellProps {
  propKey: string; value: FrontmatterValue; displayMode: PropertyDisplayMode; isEditing: boolean
  locale?: AppLocale
  vaultStatuses: string[]; vaultTags: string[]
  onStartEdit: (key: string | null) => void; onSave: (key: string, value: string) => void
  onSaveList: (key: string, items: string[]) => void; onUpdate?: (key: string, value: FrontmatterValue) => void
}

export interface ScalarEditProps {
  value: string
  isEditing: boolean
  onStartEdit: () => void
  onSave: (nextValue: string) => void
  onCancel: () => void
}

function autoDetectStringValue(value: string): PropertyDisplayMode {
  if (isUrlValue(value)) return 'url'
  if (isValidCssColor(value) && value.startsWith('#')) return 'color'
  return 'text'
}

export function autoDetectFromValue(propKey: string, value: FrontmatterValue): PropertyDisplayMode {
  if (canonicalSystemMetadataKey(propKey) === '_icon') return 'text'
  if (typeof value === 'boolean') return 'boolean'
  return typeof value === 'string' ? autoDetectStringValue(value) : 'text'
}

export function createScalarEditProps(props: SmartCellProps): ScalarEditProps {
  const { propKey, value, isEditing, onStartEdit, onSave } = props
  return {
    value: String(value ?? ''),
    isEditing,
    onStartEdit: () => onStartEdit(propKey),
    onSave: (nextValue: string) => onSave(propKey, nextValue),
    onCancel: () => onStartEdit(null),
  }
}

export interface ScalarRendererProps extends SmartCellProps {
  editProps: ScalarEditProps
}
