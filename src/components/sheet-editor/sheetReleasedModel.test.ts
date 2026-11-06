import { describe, expect, it, vi } from 'vitest'
import {
  isIronCalcWasmBridgeError,
  isReleasedWorkbookModelError,
  skipIfReleasedWorkbookModel,
} from './sheetReleasedModel'

describe('IronCalc released model errors', () => {
  it('classifies native null-pointer failures as recoverable wasm bridge errors', () => {
    const error = new Error('null pointer passed to rust')

    expect(isReleasedWorkbookModelError(error)).toBe(true)
    expect(isIronCalcWasmBridgeError(error)).toBe(true)
  })

  it('does not classify unrelated errors as wasm bridge failures', () => {
    expect(isIronCalcWasmBridgeError(new Error('Unexpected workbook error'))).toBe(false)
  })

  it('returns the operation value and uses the fallback for released models', () => {
    const read = vi.fn(() => 42)

    expect(skipIfReleasedWorkbookModel('selection read', null, read)).toBe(42)
    expect(read).toHaveBeenCalledOnce()

    expect(
      skipIfReleasedWorkbookModel('selection read', null, () => {
        throw new Error('null pointer passed to rust')
      }),
    ).toBeNull()
  })

  it('warns only for released models and rethrows other errors', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})

    expect(
      skipIfReleasedWorkbookModel('viewport read', null, () => {
        throw new Error('null pointer passed to rust')
      }),
    ).toBeNull()
    expect(warn).toHaveBeenCalledWith('[sheet-editor] Skipped stale workbook viewport read:', expect.any(Error))

    const error = new Error('Unexpected workbook error')
    expect(() =>
      skipIfReleasedWorkbookModel('viewport read', null, () => {
        throw error
      }),
    ).toThrow(error)
    expect(warn).toHaveBeenCalledOnce()
    warn.mockRestore()
  })
})
