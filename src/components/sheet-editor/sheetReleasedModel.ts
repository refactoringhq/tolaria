import { errorMessageIncludes } from '../../utils/vaultErrors'

const RELEASED_WORKBOOK_MODEL_ERROR = 'null pointer passed to rust'
const WASM_BINDGEN_STACK_POINTER_EXPORT = '__wbindgen_add_to_stack_pointer'

export function isReleasedWorkbookModelError(error: unknown): boolean {
  return errorMessageIncludes(error, RELEASED_WORKBOOK_MODEL_ERROR)
}

export function skipIfReleasedWorkbookModel<Result>(label: string, fallback: Result, operation: () => Result): Result {
  try {
    return operation()
  } catch (error) {
    if (!isReleasedWorkbookModelError(error)) throw error
    console.warn(`[sheet-editor] Skipped stale workbook ${label}:`, error)
    return fallback
  }
}

export function isIronCalcWasmBridgeError(error: unknown): boolean {
  return isReleasedWorkbookModelError(error) || errorMessageIncludes(error, WASM_BINDGEN_STACK_POINTER_EXPORT)
}
