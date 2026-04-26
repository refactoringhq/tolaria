import { describe, expect, it } from 'vitest'
import {
  CANONICAL_STATUSES,
  DEFAULT_STATUS_KEY,
  customStatusDef,
  getCanonicalStatus,
  isCanonicalStatus,
  resolveStatusDef,
  statusKeyOf,
} from './kanbanStatuses'

describe('kanbanStatuses', () => {
  it('exposes the five canonical statuses in stable order', () => {
    expect(CANONICAL_STATUSES.map((status) => status.key)).toEqual([
      'backlog',
      'doing',
      'review',
      'done',
      'blocked',
    ])
  })

  it('marks every canonical status as canonical', () => {
    for (const status of CANONICAL_STATUSES) {
      expect(status.canonical).toBe(true)
    }
  })

  it('detects canonical keys and rejects unknown ones', () => {
    expect(isCanonicalStatus('doing')).toBe(true)
    expect(isCanonicalStatus('done')).toBe(true)
    expect(isCanonicalStatus('wip')).toBe(false)
    expect(isCanonicalStatus(null)).toBe(false)
    expect(isCanonicalStatus(undefined)).toBe(false)
    expect(isCanonicalStatus('')).toBe(false)
  })

  it('returns the canonical definition by key', () => {
    expect(getCanonicalStatus('done')?.label).toBe('Done')
    expect(getCanonicalStatus('unknown')).toBeUndefined()
  })

  it('falls back to the default status key for null, undefined and empty values', () => {
    expect(statusKeyOf(null)).toBe(DEFAULT_STATUS_KEY)
    expect(statusKeyOf(undefined)).toBe(DEFAULT_STATUS_KEY)
    expect(statusKeyOf('')).toBe(DEFAULT_STATUS_KEY)
    expect(statusKeyOf('   ')).toBe(DEFAULT_STATUS_KEY)
    expect(statusKeyOf('doing')).toBe('doing')
  })

  it('builds a custom status def for non-canonical keys', () => {
    const def = customStatusDef('wip')
    expect(def.key).toBe('wip')
    expect(def.label).toBe('wip')
    expect(def.canonical).toBe(false)
  })

  it('resolves to canonical when known and falls back to custom otherwise', () => {
    expect(resolveStatusDef('done').canonical).toBe(true)
    expect(resolveStatusDef('done').label).toBe('Done')
    expect(resolveStatusDef('wip').canonical).toBe(false)
    expect(resolveStatusDef('wip').label).toBe('wip')
  })
})
